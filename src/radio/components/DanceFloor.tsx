import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Disc3 } from 'lucide-react';
import { Avatar } from './Avatar';
import { AVATARS } from '../avatars';
import type { PresenceEntry, Station } from '../types';
import { NowPlaying } from './NowPlaying';
import { PsyViz } from './PsyViz';
import { PaStack } from './PaStack';

function hashUid(uid: string): number {
  let h = 5381;
  for (let i = 0; i < uid.length; i++) h = ((h << 5) + h + uid.charCodeAt(i)) >>> 0;
  return h;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// The volume pill (LiveRoom, absolute bottom-4 left-4) sits over the floor's bottom strip and
// hid the avatars under it, so the crowd region stops short of it.
const CONTROLS_GUTTER_PX = 64;

// Smallest cell an avatar can have without spilling into its neighbour: the
// avatar is 0.6 of the cell, clamped up to AVATAR_MIN, so below this the clamp
// wins and tiles start overlapping. This is what actually limits the crowd.
const AVATAR_MIN = 16;
const MIN_CELL_PX = Math.ceil(AVATAR_MIN / 0.6);

// Beyond this the tiles are indistinguishable dots and it is just DOM cost.
const CROWD_HARD_CAP = 200;

// How long a cheer stays lit. Presence does not re-fire when this elapses, so DanceFloor ticks
// while any cheer is live.
export const CHEER_MS = 5000;

export function isCheering(cheerAt: number | undefined, now: number): boolean {
  return typeof cheerAt === 'number' && now - cheerAt >= 0 && now - cheerAt < CHEER_MS;
}

// `/radio?crowdtest=200` pads the floor with locally-rendered stand-ins, so crowd density can be
// judged without minting hundreds of anonymous Supabase users or pushing fake people into the
// real room (presence rides one project-wide channel). They exist only in this browser's render
// pass: nothing is tracked, sent, or visible to anyone else. Follows the existing `?debug` flag.
const CROWD_TEST_MAX = 500;

export function readCrowdTestParam(search: string): number {
  const raw = new URLSearchParams(search).get('crowdtest');
  if (raw === null) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), CROWD_TEST_MAX);
}

export function padCrowd(list: PresenceEntry[], extra: number): PresenceEntry[] {
  if (extra <= 0) return list;
  return [
    ...list,
    ...Array.from({ length: extra }, (_, i) => ({
      uid: `crowdtest-${i}`,
      deviceId: `crowdtest-${i}`,
      name: `Test ${i + 1}`,
      avatarId: AVATARS[i % AVATARS.length].id,
      position: { x: 50, y: 50 },
    })),
  ];
}

// The visualizer's own geometry, mirrored from its wrapper in the JSX below
// (left-1/2 top-[52%] -translate-y-1/2 w-[64vmin] max-w-[460px]). The crowd must
// start below it: lifting the band to clear the volume pill pushed its top row up
// into the artwork on a phone, where 64vmin is a large share of the screen.
const VIZ_CENTER_Y = 0.52;
const VIZ_VMIN_FRACTION = 0.64;
const VIZ_MAX_PX = 460;
const VIZ_CLEARANCE_PX = 4;

/** The visualizer as an exclusion circle. The crowd walks around it, never through it. */
export function vizCircle(boxW: number, boxH: number) {
  const size = Math.min(VIZ_VMIN_FRACTION * Math.min(boxW, boxH), VIZ_MAX_PX);
  return { cx: boxW / 2, cy: boxH * VIZ_CENTER_Y, r: size / 2 + VIZ_CLEARANCE_PX };
}

// The whole usable floor, not a strip. The old band was the bottom quarter, which is why nobody
// could ever stand near the speakers: there was no floor under them. Top clears the now-playing
// banner and the PA stack; bottom clears the volume pill.
const REGION_TOP_FRACTION = 0.2;
const REGION_SIDE_MARGIN = 0.03;
// The now-playing banner plus the DJ on the riser. Fixed px, because both are fixed-height
// elements: on a short window a fraction alone would put the crowd on top of the DJ.
const STAGE_BOTTOM_PX = 210;

export function crowdRegion(boxW: number, boxH: number) {
  const x0 = boxW * REGION_SIDE_MARGIN;
  const y0 = Math.max(boxH * REGION_TOP_FRACTION, STAGE_BOTTOM_PX);
  return {
    x0,
    y0,
    x1: boxW - x0,
    y1: Math.max(y0 + MIN_CELL_PX, boxH - CONTROLS_GUTTER_PX),
  };
}

export interface Waypoint { x: number; y: number }

/**
 * The roam path expressed as CSS custom properties: offsets in px from the tile's anchor, which
 * is where the grid placed it. Offsets rather than absolute positions so the tile keeps its
 * `translate(-50%,-50%)` centring and the animation composes with it.
 */
export function roamVars(uid: string, boxW: number, boxH: number) {
  const path = roamPath(uid, boxW, boxH);
  const [anchor, ...rest] = path;
  const vars: Record<string, string> = {};
  rest.slice(0, 4).forEach((p, i) => {
    vars[`--r${i + 1}x`] = `${Math.round(p.x - anchor.x)}px`;
    vars[`--r${i + 1}y`] = `${Math.round(p.y - anchor.y)}px`;
  });
  return { anchor, vars };
}

/**
 * A deterministic looping tour of the floor for one listener. Seeded from the uid so somebody
 * stands in the same places on every device and across reloads, exactly as the grid and the bob
 * already are. Waypoints are rejection-sampled out of the visualizer, and the tour returns toward
 * where it began so people drift back rather than leaving in one direction forever.
 */
export function roamPath(uid: string, boxW: number, boxH: number, steps = 5): Waypoint[] {
  const region = crowdRegion(boxW, boxH);
  const viz = vizCircle(boxW, boxH);
  const w = region.x1 - region.x0;
  const h = region.y1 - region.y0;

  let seed = hashUid(uid);
  const next = () => {
    // xorshift: hashUid alone repeats badly across the low bits when sampled many times.
    seed ^= seed << 13; seed >>>= 0;
    seed ^= seed >> 17;
    seed ^= seed << 5; seed >>>= 0;
    return seed / 0xffffffff;
  };

  const outside = (p: Waypoint) => Math.hypot(p.x - viz.cx, p.y - viz.cy) > viz.r;

  /**
   * The animation interpolates in a straight line between waypoints, so clearing the circle at
   * each waypoint is not enough: two points on opposite sides send the avatar straight through
   * the artwork. This is the distance from the circle's centre to the SEGMENT.
   */
  const segmentClears = (a: Waypoint, b: Waypoint) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : clamp(((viz.cx - a.x) * dx + (viz.cy - a.y) * dy) / lenSq, 0, 1);
    return Math.hypot(a.x + t * dx - viz.cx, a.y + t * dy - viz.cy) > viz.r;
  };
  // Last resort, and it must actually be outside: the region corner furthest from the artwork.
  // A radial push can be clamped straight back inside on a narrow box, so it cannot be trusted
  // as the final answer.
  const corners: Waypoint[] = [
    { x: region.x0, y: region.y0 }, { x: region.x1, y: region.y0 },
    { x: region.x0, y: region.y1 }, { x: region.x1, y: region.y1 },
  ];
  const refuge = corners.reduce((best, c) =>
    Math.hypot(c.x - viz.cx, c.y - viz.cy) > Math.hypot(best.x - viz.cx, best.y - viz.cy) ? c : best);

  const points: Waypoint[] = [];
  for (let i = 0; i < steps; i++) {
    const prev = points[i - 1];
    // Fallback is "stay put for this leg", which is a degenerate segment and therefore always
    // clear. Sampling almost always succeeds; this only has to be safe, not interesting.
    let p = prev ?? refuge;
    for (let attempt = 0; attempt < 40; attempt++) {
      const candidate = { x: region.x0 + next() * w, y: region.y0 + next() * h };
      if (!outside(candidate)) continue;
      // The leg travelled to get here must clear the artwork too, not just the destination.
      if (prev && !segmentClears(prev, candidate)) continue;
      // The tour loops, so the last leg home is a real leg and has to clear it as well.
      if (i === steps - 1 && !segmentClears(candidate, points[0])) continue;
      p = candidate;
      break;
    }
    points.push(p);
  }

  // Repair pass. Collapsing a waypoint onto its predecessor turns that leg into a point, so this
  // always terminates and always ends with a tour that clears the artwork on every leg.
  for (let i = 1; i < points.length; i++) {
    if (!segmentClears(points[i - 1], points[i])) points[i] = points[i - 1];
  }
  if (!segmentClears(points[points.length - 1], points[0])) {
    for (let i = 1; i < points.length; i++) points[i] = points[0];
  }
  return points;
}

/**
 * How many listeners actually fit the measured band before tiles would overlap.
 * Replaces a fixed cap of 30, which was roughly the phone's capacity and so threw
 * away most of the crowd on a wide desktop window. Everyone past this is summed
 * into the "+N in the crowd" badge.
 */
export function crowdCapacity(boxW: number, boxH: number): number {
  const r = crowdRegion(boxW, boxH);
  const viz = vizCircle(boxW, boxH);
  const usable = Math.max(0, (r.x1 - r.x0) * (r.y1 - r.y0) - Math.PI * viz.r * viz.r);
  return Math.max(1, Math.min(Math.floor(usable / (MIN_CELL_PX * MIN_CELL_PX)), CROWD_HARD_CAP));
}

/**
 * Avatar size for a roaming crowd. Density comes from the floor area each listener has, not from
 * a grid cell: there are no cells any more. Shrinks as the room fills, exactly as before, and
 * drops the name label once it no longer fits beside the avatar.
 */
export function crowdTileSize(total: number, boxW: number, boxH: number) {
  const r = crowdRegion(boxW, boxH);
  const viz = vizCircle(boxW, boxH);
  const usable = Math.max(1, (r.x1 - r.x0) * (r.y1 - r.y0) - Math.PI * viz.r * viz.r);
  const per = Math.sqrt(usable / Math.max(1, total));
  const size = Math.round(clamp(0.6 * per, AVATAR_MIN, AVATAR_BASE));
  return { size, hasLabel: per >= LABEL_W && per >= size + LABEL_GAP + LABEL_H };
}

// Fallback box size for the very first paint (before ResizeObserver reports
// real dimensions) and for jsdom in tests, which never measures a layout.
const FALLBACK_BOX = { w: 400, h: 600 };

// A full-size crowd tile's real rendered footprint: the label below the
// avatar is wider than the avatar circle, and the tile's height is the
// avatar plus the gap plus the label. Sizing cells off this (not the avatar
// alone) is what keeps name labels from colliding even when the avatars
// themselves are correctly spaced.
export const AVATAR_BASE = 44;
export const LABEL_W = 84;
export const LABEL_GAP = 6;
export const LABEL_H = 14;


// Tracks the real pixel size of an element so the crowd grid can be computed
// in actual px, not just band percentages — a phone (narrow, tall) and a
// desktop window (wide, short) need very different row/column splits to
// avoid overlap, and percentages alone can't tell the two apart.
function useMeasuredSize(ref: RefObject<HTMLElement | null>) {
  const [box, setBox] = useState(FALLBACK_BOX);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref]);
  return box;
}

interface DanceFloorProps {
  presenceList: PresenceEntry[];
  station: Station | null;
  uid: string;
  nowPlaying?: { name: string; visible: boolean };
}

const GHOST_ENTRIES: PresenceEntry[] = [
  { uid: 'ghost-1', deviceId: 'ghost-1', name: '???', avatarId: AVATARS[0].id, position: { x: 30, y: 40 } },
  { uid: 'ghost-2', deviceId: 'ghost-2', name: '???', avatarId: AVATARS[3].id, position: { x: 50, y: 62 } },
  { uid: 'ghost-3', deviceId: 'ghost-3', name: '???', avatarId: AVATARS[7].id, position: { x: 70, y: 45 } },
];

// Deterministic ambient particles drifting up off the floor.
const MOTES = Array.from({ length: 14 }, (_, i) => ({
  left: (i * 37) % 100,
  bottom: (i * 53) % 38,
  size: 2 + (i % 3),
  duration: 7 + (i % 6),
  delay: (i % 7) * 0.9,
  color: ['#26C6DA', '#7B2FBE', '#FF2079', '#FFFFFF'][i % 4],
}));

export function DanceFloor({
  presenceList,
  station,
  uid,
  nowPlaying,
}: DanceFloorProps) {
  const crowdTest = useMemo(
    () => (typeof window === 'undefined' ? 0 : readCrowdTestParam(window.location.search)),
    [],
  );
  const roster = useMemo(() => padCrowd(presenceList, crowdTest), [presenceList, crowdTest]);

  const isGhost = roster.length === 0;
  const live = station?.mode === 'live';
  const floorRef = useRef<HTMLDivElement>(null);
  const box = useMeasuredSize(floorRef);

  // A cheer expires on a clock, not on a presence event, so nothing would otherwise re-render it
  // away. `now` is read per render (never held in state, which would leave a fresh cheer compared
  // against a stale clock); the tick exists only to force those renders, and only runs while a
  // cheer is actually live, so an idle room pays nothing.
  const [, forceTick] = useState(0);
  const now = Date.now();
  const anyCheer = roster.some((e) => isCheering(e.cheerAt, now));
  useEffect(() => {
    if (!anyCheer) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [anyCheer]);

  const cap = crowdCapacity(box.w, box.h);
  const tile = crowdTileSize(Math.min(roster.length, cap), box.w, box.h);
  const overflow = Math.max(0, roster.length - cap);
  const visible = isGhost
    ? GHOST_ENTRIES
    : [...roster]
        .sort((a, b) => (a.deviceId ?? a.uid).localeCompare(b.deviceId ?? b.uid))
        .slice(0, cap);

  return (
    <div ref={floorRef} className="relative w-full h-full overflow-hidden bg-[#05060f]">
      {/* Atmosphere layers (decorative) */}
      <div className="absolute inset-0 radio-nebula" aria-hidden="true" />
      <div className="absolute inset-0 radio-stars" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-2/5 radio-aurora" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-1/3 radio-stage-backdrop" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] radio-floor-glow" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] radio-grid" aria-hidden="true" />

      {/* Psychedelic geometric animation — always on, no AudioContext */}
      <div
        className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 w-[64vmin] h-[64vmin] max-w-[460px] max-h-[460px] z-[2] pointer-events-none"
        data-testid="psyviz"
      >
        <PsyViz />
      </div>

      {/* Floating motes */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {MOTES.map((m, i) => (
          <span
            key={i}
            className="radio-mote absolute"
            style={{
              left: `${m.left}%`,
              bottom: `${m.bottom}%`,
              width: m.size,
              height: m.size,
              backgroundColor: m.color,
              boxShadow: `0 0 6px ${m.color}`,
              animationDuration: `${m.duration}s`,
              animationDelay: `${m.delay}s`,
            }}
          />
        ))}
      </div>

      {/* ── FLANKING PA (static Turbosound Floodlight; CSS-only glow) ── */}
      <div className="absolute top-[88px] left-[0.5%] z-[8] hidden min-[400px]:block w-[96px] sm:w-[150px] lg:w-[210px] pointer-events-none">
        <PaStack side="left" />
      </div>
      <div className="absolute top-[88px] right-[0.5%] z-[8] hidden min-[400px]:block w-[96px] sm:w-[150px] lg:w-[210px] pointer-events-none">
        <PaStack side="right" />
      </div>

      {/* ── STAGE ────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-10 flex flex-col items-center gap-2 px-4 pt-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 ${live ? 'bg-[#FF0033] pixel-blink' : 'rounded-full bg-[#39405a]'}`}
            aria-hidden="true"
          />
          <span className="pixel text-[10px] text-white/60">
            {live ? 'On Air' : 'Standby'}
          </span>
        </div>

        {/* Decks / now-playing console */}
        <div className="relative flex items-center gap-3 px-4 sm:px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md radio-booth-glow w-full">
          <Disc3
            className={`w-7 h-7 shrink-0 text-[#26C6DA] ${live ? 'radio-spin' : ''}`}
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <div className="min-w-0 flex flex-col">
            <span className="font-display text-sm text-white tracking-wide truncate">
              SUBSPACE RESONATOR
            </span>
            <NowPlaying station={station} nowPlaying={nowPlaying} />
          </div>
          {live && (
            <div className="ml-1 hidden sm:flex items-end gap-[3px] h-7 w-12 shrink-0" aria-hidden="true">
              {Array.from({ length: 7 }).map((_, i) => (
                <span
                  key={i}
                  className="flex-1 bg-[#26C6DA]/80 rounded-full self-end radio-eq"
                  style={{ animationDelay: `${i * 90}ms` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Broadcaster (DJ) on the stage riser, under a spotlight */}
        <div className="relative flex flex-col items-center mt-1" data-testid="broadcaster">
          {live && (
            <div className="absolute -top-2 w-40 h-28 radio-spotlight pointer-events-none" aria-hidden="true" />
          )}
          <BroadcasterAvatar live={live} />
          <div className="radio-riser w-24 h-3 -mt-1" aria-hidden="true" />
          <span className="pixel text-[10px] text-[#FF00AA] mt-0.5">
            {live ? 'LIVE DJ' : 'OFF AIR'}{live && <span className="pixel-blink">_</span>}
          </span>
        </div>
      </div>

      {/* ── DANCEFLOOR CROWD ─────────────────────────────────── */}
      {visible.map((entry) => {
        const isSelf = entry.uid === uid;
        const h = hashUid(entry.uid);
        const delay = `${(h % 20) * 120}ms`;
        const duration = `${3 + (h % 6) * 0.4}s`;
        // Position comes from the tour's first waypoint, not a grid cell. With a grid anchor the
        // crowd snapped back into formation every time the loop came round, which is the
        // formation look this replaced.
        const { anchor, vars } = roamVars(entry.uid, box.w, box.h);
        const px = (anchor.x / box.w) * 100;
        const py = (anchor.y / box.h) * 100;
        const { size, hasLabel } = tile;
        const cheering = isCheering(entry.cheerAt, now);
        return (
          <div
            key={entry.uid}
            // A cheering tile lifts above its neighbours. Every tile shared z-[5], so paint order
            // was DOM order and the one moment a listener wants to be seen was the moment their
            // glow could land behind someone else's avatar.
            className={`radio-slot absolute ${cheering ? 'z-[7]' : 'z-[5]'} flex flex-col items-center`}
            style={{
              left: `${px}%`,
              top: `${py}%`,
              transform: 'translate(-50%, -50%)',
              opacity: isGhost ? 0.3 : 1,
            }}
          >
            {/* Roaming needs its own element: the slot owns translate(-50%,-50%) and the inner
                div owns the bob, and one element cannot carry two transforms. */}
            <div
              className="radio-roam relative flex flex-col items-center"
              style={{
                ...vars,
                // Long, and seeded per listener, so the crowd is mid-journey on arrival rather
                // than every avatar setting off from its anchor at once.
                ['--roam-dur' as string]: `${70 + (h % 50)}s`,
                animationDelay: `-${h % 70}s`,
              }}
            >
              {/* "You": a follow-spot pooling on the floor under your feet, not a box around
                  your avatar. Reads at any density and does not fight the neon look. */}
              {isSelf && (
                <span
                  className="radio-you absolute left-1/2 pointer-events-none"
                  aria-hidden="true"
                  data-testid="you-marker"
                  style={{
                    top: Math.round(size * 0.55),
                    width: Math.round(size * 1.9),
                    height: Math.round(size * 0.75),
                  }}
                />
              )}
              <div
                className={cheering ? 'radio-dance radio-cheer' : 'radio-bob'}
                style={cheering
                  // Halo scales with the avatar so it stops bleeding onto neighbours when packed.
                  ? { ['--halo' as string]: `${Math.round(size * 0.9)}px` }
                  : { animationDelay: delay, animationDuration: duration }}
                data-cheering={cheering ? 'true' : undefined}
              >
                <Avatar avatarId={entry.avatarId} size={isSelf ? size + 6 : size} label={entry.name} />
              </div>
              {hasLabel && (
                <span className="font-mono text-white/80 text-[11px] leading-none mt-1.5 max-w-[84px] truncate">
                  {entry.name.slice(0, 14)}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {overflow > 0 && (
        <div className="absolute z-[6] bottom-2 inset-x-0 flex justify-center pointer-events-none">
          <span className="pixel text-[10px] text-white/50">
            +{overflow} in the crowd
          </span>
        </div>
      )}
    </div>
  );
}

// The host's on-stage presence: a glowing entity wearing headphones (cyan/purple).
function BroadcasterAvatar({ live }: { live: boolean }) {
  return (
    <svg
      viewBox="0 0 80 80"
      width={66}
      height={66}
      role="img"
      aria-label="Broadcaster"
      className="relative z-10"
      style={{
        color: '#26C6DA',
        filter: `drop-shadow(0 0 ${live ? 14 : 6}px #26C6DA)`,
        overflow: 'visible',
      }}
    >
      <circle cx="40" cy="40" r="34" fill="#7B2FBE" opacity="0.14" />
      {/* headphone band */}
      <path
        d="M22 40 a18 18 0 0 1 36 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* ear cups */}
      <rect x="17" y="38" width="9" height="16" rx="4" fill="currentColor" />
      <rect x="54" y="38" width="9" height="16" rx="4" fill="currentColor" />
      {/* head / core */}
      <circle cx="40" cy="42" r="13" fill="#7B2FBE" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="40" cy="42" r="5" fill="currentColor" opacity={live ? 0.9 : 0.5} />
    </svg>
  );
}
