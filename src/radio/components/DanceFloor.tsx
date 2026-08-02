import { useEffect, useRef, useState, type RefObject } from 'react';
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

// Floor band the crowd is confined to (percent of the DanceFloor box), clear
// of the central visualizer and the stage riser above it.
const FLOOR_BAND = { left: 6, top: 70, width: 88, height: 25 };

// The volume pill (LiveRoom, absolute bottom-4 left-4) overlays this same
// bottom strip, so it hid the crowd's bottom-left tiles. Taking the gutter off
// the band lifts the whole crowd clear of it instead of special-casing a corner
// out of a grid.
const CONTROLS_GUTTER_PX = 64;

// Smallest cell an avatar can have without spilling into its neighbour: the
// avatar is 0.6 of the cell, clamped up to AVATAR_MIN, so below this the clamp
// wins and tiles start overlapping. This is what actually limits the crowd.
const AVATAR_MIN = 16;
const MIN_CELL_PX = Math.ceil(AVATAR_MIN / 0.6);

// Beyond this the tiles are indistinguishable dots and it is just DOM cost.
const CROWD_HARD_CAP = 200;

// Fraction of a tile's reserved jitter slack that wander is allowed to sweep. Below 1 so two
// neighbours drifting toward each other stay strictly apart rather than exactly touching.
const WANDER_AMPLITUDE = 0.8;

// How long a cheer stays lit. Presence does not re-fire when this elapses, so DanceFloor ticks
// while any cheer is live.
export const CHEER_MS = 5000;

export function isCheering(cheerAt: number | undefined, now: number): boolean {
  return typeof cheerAt === 'number' && now - cheerAt >= 0 && now - cheerAt < CHEER_MS;
}

// The band is LIFTED by the gutter, not shrunk by it. Shrinking cost the name labels for
// ordinary small crowds on a phone (two rows in 86px instead of 150px, so no cell was tall
// enough for a label), which is a worse trade than moving the same band up.
function bandPx(boxW: number, boxH: number) {
  const h = (boxH * FLOOR_BAND.height) / 100;
  const naturalTop = (boxH * FLOOR_BAND.top) / 100;
  return {
    w: (boxW * FLOOR_BAND.width) / 100,
    h,
    top: Math.max(boxH * 0.45, naturalTop - CONTROLS_GUTTER_PX),
  };
}

/**
 * How many listeners actually fit the measured band before tiles would overlap.
 * Replaces a fixed cap of 30, which was roughly the phone's capacity and so threw
 * away most of the crowd on a wide desktop window. Everyone past this is summed
 * into the "+N in the crowd" badge.
 */
export function crowdCapacity(boxW: number, boxH: number): number {
  const { w, h } = bandPx(boxW, boxH);
  const cols = Math.max(1, Math.floor(w / MIN_CELL_PX));
  const rows = Math.max(1, Math.floor(h / MIN_CELL_PX));
  return Math.min(cols * rows, CROWD_HARD_CAP);
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
const FOOTPRINT_W = LABEL_W;
const FOOTPRINT_H = AVATAR_BASE + LABEL_GAP + LABEL_H;

// Pick a grid that fits everyone at full size if the band is big enough;
// only fall back to the density-driven (shrinking) layout once it isn't.
function computeGridDims(total: number, bandWpx: number, bandHpx: number) {
  const fullCols = Math.max(1, Math.floor(bandWpx / FOOTPRINT_W));
  const fullRows = Math.max(1, Math.floor(bandHpx / FOOTPRINT_H));
  if (fullCols * fullRows >= total) {
    const cols = Math.max(1, Math.min(fullCols, total));
    return { cols, rows: Math.max(1, Math.ceil(total / cols)) };
  }
  const cols = Math.max(1, Math.round(Math.sqrt((total * bandWpx) / bandHpx)));
  return { cols, rows: Math.max(1, Math.ceil(total / cols)) };
}

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

// Deterministic row/column slot for a listener within the visible (stably
// sorted) crowd, computed in real pixels so it holds at any viewport size.
// Avatar size is derived from the cell it's given (smaller cells -> smaller
// avatars), and jitter is capped at a fraction of the slack left after
// sizing the avatar, so two adjacent tiles can never actually touch.
export function gridSlot(index: number, total: number, uid: string, boxW: number, boxH: number) {
  const { w: bandWpx, h: bandHpx, top: bandTopPx } = bandPx(boxW, boxH);
  const { cols, rows } = computeGridDims(total, bandWpx, bandHpx);
  const col = index % cols;
  const row = Math.floor(index / cols);

  const cellWpx = bandWpx / cols;
  const cellHpx = bandHpx / rows;
  const size = Math.round(clamp(0.6 * Math.min(cellWpx, cellHpx), 16, AVATAR_BASE));
  // Only show the label if its footprint (label width, avatar+gap+label height)
  // actually fits the cell — otherwise it would spill into the neighboring tile.
  const hasLabel = cellWpx >= LABEL_W && cellHpx >= size + LABEL_GAP + LABEL_H;

  const footprintWpx = hasLabel ? LABEL_W : size;
  const footprintHpx = hasLabel ? size + LABEL_GAP + LABEL_H : size;

  const h = hashUid(uid);
  const maxJitterXpx = Math.max(0, 0.25 * (cellWpx - footprintWpx));
  const maxJitterYpx = Math.max(0, 0.25 * (cellHpx - footprintHpx));
  const jitterXpx = ((h % 100) / 100 - 0.5) * 2 * maxJitterXpx;
  const jitterYpx = (((h >> 8) % 100) / 100 - 0.5) * 2 * maxJitterYpx;

  const px = FLOOR_BAND.left + ((cellWpx * (col + 0.5) + jitterXpx) / boxW) * 100;
  const py = ((bandTopPx + cellHpx * (row + 0.5) + jitterYpx) / boxH) * 100;

  // Wander re-spends the SAME slack the static jitter is drawn from, so drifting cannot buy a
  // tile more room than the layout already proved it has. Worst case is two neighbours swinging
  // at each other: centres start a cell apart and close by 2*wander, which stays wider than the
  // footprint for any cell >= footprint. WANDER_AMPLITUDE is the margin that keeps that
  // inequality strict instead of merely tangent.
  const wanderXpx = WANDER_AMPLITUDE * maxJitterXpx;
  const wanderYpx = WANDER_AMPLITUDE * maxJitterYpx;

  return { px, py, size, hasLabel, wanderXpx, wanderYpx };
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
  const isGhost = presenceList.length === 0;
  const live = station?.mode === 'live';
  const floorRef = useRef<HTMLDivElement>(null);
  const box = useMeasuredSize(floorRef);

  // A cheer expires on a clock, not on a presence event, so nothing would otherwise re-render it
  // away. `now` is read per render (never held in state, which would leave a fresh cheer compared
  // against a stale clock); the tick exists only to force those renders, and only runs while a
  // cheer is actually live, so an idle room pays nothing.
  const [, forceTick] = useState(0);
  const now = Date.now();
  const anyCheer = presenceList.some((e) => isCheering(e.cheerAt, now));
  useEffect(() => {
    if (!anyCheer) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [anyCheer]);

  const cap = crowdCapacity(box.w, box.h);
  const overflow = Math.max(0, presenceList.length - cap);
  const visible = isGhost
    ? GHOST_ENTRIES
    : [...presenceList]
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
      {visible.map((entry, i) => {
        const isSelf = entry.uid === uid;
        const h = hashUid(entry.uid);
        const delay = `${(h % 20) * 120}ms`;
        const duration = `${3 + (h % 6) * 0.4}s`;
        const { px, py, size, hasLabel, wanderXpx, wanderYpx } =
          gridSlot(i, visible.length, entry.uid, box.w, box.h);
        const cheering = isCheering(entry.cheerAt, now);
        return (
          <div
            key={entry.uid}
            className="radio-slot absolute z-[5] flex flex-col items-center"
            style={{
              left: `${px}%`,
              top: `${py}%`,
              transform: 'translate(-50%, -50%)',
              opacity: isGhost ? 0.3 : 1,
            }}
          >
            {/* Wander needs its own element: the slot owns translate(-50%,-50%) and the inner
                div owns the bob, and one element cannot carry two transforms. */}
            <div
              className="radio-wander flex flex-col items-center"
              style={{
                ['--wx' as string]: `${wanderXpx}px`,
                ['--wy' as string]: `${wanderYpx}px`,
                ['--wander-dur' as string]: `${9 + (h % 9)}s`,
                animationDelay: `-${h % 9}s`,
              }}
            >
              <div
                className={`${cheering ? 'radio-dance radio-cheer' : 'radio-bob'} ${isSelf ? 'rounded-full ring-2 ring-white/80 ring-offset-2 ring-offset-transparent' : ''}`}
                style={cheering ? undefined : { animationDelay: delay, animationDuration: duration }}
                data-cheering={cheering ? 'true' : undefined}
              >
                <Avatar avatarId={entry.avatarId} size={isSelf ? size + 12 : size} label={entry.name} />
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
