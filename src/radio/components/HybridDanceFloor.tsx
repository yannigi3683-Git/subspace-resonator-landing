import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Avatar } from './Avatar';
import { AVATARS } from '../avatars';
import type { PresenceEntry, Station } from '../types';
import { NowPlaying } from './NowPlaying';
import { PsyViz } from './PsyViz';
import { PaStack } from './PaStack';
import { BroadcasterAvatar, isCheering, padCrowd, readCrowdTestParam, type Rect } from './DanceFloor';
import { useCrowdMotion } from '../hooks/useCrowdMotion';
import type { CrowdEnv } from '../crowdMotion';

function hashUid(uid: string): number {
  let h = 5381;
  for (let i = 0; i < uid.length; i++) h = ((h << 5) + h + uid.charCodeAt(i)) >>> 0;
  return h;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Room for half a tile (the name under the lowest avatar) above the floor's bottom edge.
export const FLOOR_GUTTER_PX = 36;
// Tablets and desktops float the volume + CHEER pill over the floor's bottom-left corner
// (LiveRoom: `absolute bottom-4 left-4`), so it is an obstacle there. Phones, and any screen
// under 501px tall, show it as a row under the floor instead (see `short` in tailwind.config.ts).
const PILL_RECT = { w: 300, h: 56, inset: 16 };
const PILL_QUERY = '(min-width: 768px) and (min-height: 501px)';
const CROWD_HARD_CAP = 200;

// Names show while each listener has room for one (NAMED_CELL_PX); past that they drop and only the
// avatar shrinks, down to HYBRID_AVATAR_MIN, so a phone still holds a big crowd. While names show,
// the simulation's `radius` covers the name under the avatar, not just the avatar itself:
// otherwise names pile up and clip at the screen edges.
export const HYBRID_AVATAR_MIN = 14;
export const HYBRID_AVATAR_BASE = 44;
export const HYBRID_LABEL_MIN_W = 46;
export const HYBRID_LABEL_MAX_W = 84;
// The simulation pushes neighbours apart below radius * 1.7 * 2 = labelW * 1.02 at this radius:
// names may brush but not stack, which keeps names on screen for about twice the crowd.
const LABEL_RADIUS_FRACTION = 0.31;
const SEPARATION_PER_LABEL_W = LABEL_RADIUS_FRACTION * 1.7 * 2;
const NAMED_CELL_PX = Math.ceil(HYBRID_LABEL_MIN_W * SEPARATION_PER_LABEL_W);
const DOT_CELL_PX = Math.ceil(HYBRID_AVATAR_MIN / 0.6);

// The PA stacks stay on screen at every phone width (the old floor hid them below 400px). Their
// width is computed here and applied inline in the JSX, so the obstacle rects and the pixels can
// never disagree. On a phone they shrink so the gap between them (where the neon box sits) is
// never narrower than PHONE_STAGE_GAP_PX: 120px each on a 412px phone, 95px on 360, 75px on 320.
const PA_TOP_PX = 64;
const PA_ASPECT = 260 / 200;
const OBSTACLE_MARGIN_PX = 12;
const PHONE_STAGE_GAP_PX = 170;
// A floor shorter than this (a phone held sideways) cannot fit speakers, DJ, visualizer and a
// crowd stacked vertically, so the speakers go and the visualizer fits the space under the stage.
const COMPACT_FLOOR_H = 520;

const isCompact = (boxW: number, boxH: number) => boxH < COMPACT_FLOOR_H && boxW > boxH;

export function paWidthPx(boxW: number, boxH = Infinity): number {
  if (isCompact(boxW, boxH)) return 0;
  if (boxW >= 1300) return 290;
  if (boxW >= 704) return 230;
  if (boxW >= 640) return 170;
  return Math.max(60, Math.min(120, Math.floor((boxW - PHONE_STAGE_GAP_PX) / 2)));
}

export function hybridObstacleRects(boxW: number, boxH: number, pill = false): Rect[] {
  const m = OBSTACLE_MARGIN_PX;
  const pillRect: Rect[] = pill
    ? [{ x0: 0, y0: boxH - PILL_RECT.inset - PILL_RECT.h - m, x1: PILL_RECT.inset + PILL_RECT.w + m, y1: boxH }]
    : [];
  const w = paWidthPx(boxW, boxH);
  if (w === 0) return pillRect;
  const h = w * PA_ASPECT;
  const inset = boxW * 0.005;
  const top = PA_TOP_PX - m;
  const bottom = Math.min(PA_TOP_PX + h + m, boxH);
  return [
    { x0: inset - m, y0: top, x1: inset + w + m, y1: bottom },
    { x0: boxW - inset - w - m, y0: top, x1: boxW - inset + m, y1: bottom },
    ...pillRect,
  ];
}

const REGION_TOP_FRACTION = 0.2;
const REGION_SIDE_MARGIN = 0.03;
// Title, status row and the DJ on the riser with the neon box (up to 3 lines): fixed height, px.
const STAGE_BOTTOM_PX = 200;

// The original PsyViz: 64% of the floor's short side, max 460px, centred at 52% of its height.
// Compact floors put it in the middle of the space left under the stage instead.
export function hybridViz(boxW: number, boxH: number) {
  if (isCompact(boxW, boxH)) {
    const free = Math.max(0, boxH - STAGE_BOTTOM_PX);
    const size = Math.max(0, Math.min(free * 0.9, boxW * 0.64, 460));
    return { size, cx: boxW / 2, cy: STAGE_BOTTOM_PX + free / 2 };
  }
  // On a short floor (a small phone) 52% would push it up into the DJ and the neon box, so it
  // shrinks to fit under the stage and never starts above STAGE_BOTTOM_PX.
  const size = Math.max(0, Math.min(0.64 * Math.min(boxW, boxH), 460, boxH - STAGE_BOTTOM_PX - 48));
  return { size, cx: boxW / 2, cy: Math.max(boxH * 0.52, STAGE_BOTTOM_PX + 8 + size / 2) };
}

function hybridVizCircle(boxW: number, boxH: number) {
  const v = hybridViz(boxW, boxH);
  return { cx: v.cx, cy: v.cy, r: v.size / 2 + 4 };
}

export function hybridCrowdRegion(boxW: number, boxH: number) {
  const x0 = boxW * REGION_SIDE_MARGIN;
  const y0 = Math.max(boxH * REGION_TOP_FRACTION, STAGE_BOTTOM_PX);
  return { x0, y0, x1: boxW - x0, y1: Math.max(y0 + DOT_CELL_PX, boxH - FLOOR_GUTTER_PX) };
}

function usableFloorPx(boxW: number, boxH: number, pill = false): number {
  const r = hybridCrowdRegion(boxW, boxH);
  const viz = hybridVizCircle(boxW, boxH);
  const blocked = hybridObstacleRects(boxW, boxH, pill).reduce((sum, o) => {
    const w = Math.max(0, Math.min(o.x1, r.x1) - Math.max(o.x0, r.x0));
    const h = Math.max(0, Math.min(o.y1, r.y1) - Math.max(o.y0, r.y0));
    return sum + w * h;
  }, Math.PI * viz.r * viz.r);
  return Math.max(1, (r.x1 - r.x0) * (r.y1 - r.y0) - blocked);
}

export function hybridCrowdCapacity(boxW: number, boxH: number, pill = false): number {
  return Math.max(1, Math.min(Math.floor(usableFloorPx(boxW, boxH, pill) / (DOT_CELL_PX * DOT_CELL_PX)), CROWD_HARD_CAP));
}

/**
 * Layout for a given crowd size. The avatar and the name's width shrink together as the floor
 * fills; once a name no longer fits (`hasLabel` false) names drop and the avatar keeps shrinking.
 * The region is inset by half a name so the widest label can never be pushed off the screen.
 */
export function hybridLayout(total: number, boxW: number, boxH: number, pill = false) {
  const per = Math.sqrt(usableFloorPx(boxW, boxH, pill) / Math.max(1, total));
  const hasLabel = per >= NAMED_CELL_PX;
  const labelW = hasLabel ? Math.round(clamp(0.7 * per, HYBRID_LABEL_MIN_W, HYBRID_LABEL_MAX_W)) : 0;
  const size = Math.round(clamp(0.6 * per, HYBRID_AVATAR_MIN, HYBRID_AVATAR_BASE));
  const base = hybridCrowdRegion(boxW, boxH);
  const inset = Math.max(boxW * REGION_SIDE_MARGIN, Math.max(labelW, size) / 2 + 2);
  return {
    size,
    hasLabel,
    labelW,
    fontSize: labelW >= 64 ? 11 : 10,
    radius: Math.max(size / 2, labelW * LABEL_RADIUS_FRACTION),
    // Centres are clamped to the region, so it starts half an avatar down: no avatar can poke up
    // into the neon box.
    region: { x0: inset, y0: base.y0 + size / 2, x1: boxW - inset, y1: base.y1 },
  };
}

const FALLBACK_BOX = { w: 400, h: 600 };

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

interface HybridDanceFloorProps {
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

export function HybridDanceFloor({ presenceList, station, uid, nowPlaying }: HybridDanceFloorProps) {
  const crowdTest = useMemo(
    () => (typeof window === 'undefined' ? 0 : readCrowdTestParam(window.location.search)),
    [],
  );
  const roster = useMemo(() => padCrowd(presenceList, crowdTest), [presenceList, crowdTest]);

  const isGhost = roster.length === 0;
  const live = station?.mode === 'live';
  const floorRef = useRef<HTMLDivElement>(null);
  const box = useMeasuredSize(floorRef);
  // ponytail: read on mount and on each floor resize; a rotation resizes the floor, so it follows.
  const pill = typeof window !== 'undefined' && window.matchMedia?.(PILL_QUERY).matches === true;

  const [, forceTick] = useState(0);
  const now = Date.now();
  const anyCheer = roster.some((e) => isCheering(e.cheerAt, now));
  useEffect(() => {
    if (!anyCheer) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [anyCheer]);

  const viz = hybridViz(box.w, box.h);
  const paW = paWidthPx(box.w, box.h);
  const cap = hybridCrowdCapacity(box.w, box.h, pill);
  const shown = Math.min(roster.length, cap);
  const tile = hybridLayout(shown, box.w, box.h, pill);
  const overflow = Math.max(0, roster.length - cap);
  const visible = isGhost
    ? GHOST_ENTRIES
    : [...roster]
        .sort((a, b) => (a.deviceId ?? a.uid).localeCompare(b.deviceId ?? b.uid))
        .slice(0, cap);

  const crowdEnv = useMemo<CrowdEnv>(() => ({
    region: tile.region,
    viz: hybridVizCircle(box.w, box.h),
    rects: hybridObstacleRects(box.w, box.h, pill),
    radius: tile.radius,
    speed: 26,
  }), [box.w, box.h, tile.region, tile.radius, pill]);
  const nodes = useCrowdMotion(visible.map((e) => e.uid), crowdEnv, visible.length > 0);

  return (
    <div ref={floorRef} className="relative w-full h-full overflow-hidden bg-[#05060f]">
      <div className="absolute inset-0 radio-nebula" aria-hidden="true" />
      <div className="absolute inset-0 radio-stars" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-2/5 radio-aurora" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-1/3 radio-stage-backdrop" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] radio-floor-glow" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] radio-grid" aria-hidden="true" />

      {/* The original visualizer; its geometry comes from hybridViz, the same numbers the crowd avoids. */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 z-[2] pointer-events-none"
        style={{ left: viz.cx, top: viz.cy, width: viz.size, height: viz.size }}
        data-testid="psyviz"
      >
        <PsyViz />
      </div>

      {paW > 0 && (
        <>
          <div className="absolute top-[64px] left-[0.5%] z-[8] pointer-events-none" style={{ width: paW }}>
            <PaStack side="left" />
          </div>
          <div className="absolute top-[64px] right-[0.5%] z-[8] pointer-events-none" style={{ width: paW }}>
            <PaStack side="right" />
          </div>
        </>
      )}

      <div className="absolute top-0 inset-x-0 z-10 flex flex-col items-center gap-2 px-4 pt-3">
        <h2 className="font-display font-bold text-[13px] md:text-[15px] leading-none tracking-[0.12em] text-white text-center whitespace-nowrap">
          SUBSPACE RESONATOR <span className="text-[#26C6DA] radio-title-glow">LIVE RADIO</span>
        </h2>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 ${live ? 'bg-[#FF0033] pixel-blink' : 'rounded-full bg-[#39405a]'}`}
            aria-hidden="true"
          />
          <span className="pixel text-[10px] text-white/60">{live ? 'ON AIR' : 'STANDBY'}</span>
          <span className="pixel text-[10px] text-[#FFB84D] ml-2" data-testid="aboard">
            ABOARD {String(roster.length).padStart(2, '0')}
          </span>
          {overflow > 0 && (
            <span className="pixel text-[10px] text-white/50" data-testid="crowd-overflow">
              +{overflow} in the crowd
            </span>
          )}
        </div>

        <div className="relative flex flex-col items-center mt-1" data-testid="broadcaster">
          {live && (
            <div className="absolute -top-2 w-40 h-28 radio-spotlight pointer-events-none" aria-hidden="true" />
          )}
          <BroadcasterAvatar live={live} />
          <div className="radio-riser w-24 h-3 -mt-1" aria-hidden="true" />
          {/* The box hugs its text and stays inside the gap between the speakers with 8px clear
              on each side; a long title wraps to two lines (NowPlaying neon) instead. */}
          <div className="mt-1 flex justify-center" style={{ maxWidth: Math.min(box.w - 2 * (paW + box.w * 0.005 + 8), 360) }} data-testid="stage-now-playing">
            {live
              ? <NowPlaying station={station} nowPlaying={nowPlaying} neon />
              : <span className="pixel text-[12px] text-[#FF5CCB] radio-neon text-center px-2.5 py-1.5 rounded-md bg-black/80 border border-[#FF00AA]/40">OFF AIR</span>}
          </div>
        </div>
      </div>

      {visible.map((entry, i) => {
        const isSelf = entry.uid === uid;
        const h = hashUid(entry.uid);
        const delay = `${(h % 20) * 120}ms`;
        const duration = `${3 + (h % 6) * 0.4}s`;
        const { size } = tile;
        const cheering = isCheering(entry.cheerAt, now);
        return (
          <div
            key={entry.uid}
            ref={(el) => { nodes.current[i] = el; }}
            data-crowd-tile=""
            className={`absolute left-0 top-0 ${cheering ? 'z-[7]' : 'z-[5]'} flex flex-col items-center`}
            style={{ opacity: isGhost ? 0.3 : 1 }}
          >
            <div className="relative flex flex-col items-center">
              {isSelf && (
                <span
                  className="radio-orbit absolute pointer-events-none"
                  aria-hidden="true"
                  data-testid="you-marker"
                  style={{
                    width: size + 10,
                    height: size + 10,
                    top: -5,
                    ['--orbit-r' as string]: `${Math.round((size + 10) / 2)}px`,
                  }}
                />
              )}
              <div
                className={cheering ? 'radio-dance radio-cheer' : 'radio-bob'}
                style={cheering
                  ? { ['--halo' as string]: `${Math.round(size * 0.9)}px` }
                  : { animationDelay: delay, animationDuration: duration }}
                data-cheering={cheering ? 'true' : undefined}
              >
                <Avatar avatarId={entry.avatarId} size={isSelf ? size + 6 : size} label={entry.name} />
              </div>
              {tile.hasLabel && (
                <span
                  data-testid="crowd-name"
                  className="font-mono text-white/80 leading-none mt-1 truncate"
                  style={{ fontSize: tile.fontSize, maxWidth: tile.labelW }}
                >
                  {entry.name.slice(0, 12)}
                </span>
              )}
            </div>
          </div>
        );
      })}

    </div>
  );
}
