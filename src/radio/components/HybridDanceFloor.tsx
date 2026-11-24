import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Disc3 } from 'lucide-react';
import { Avatar } from './Avatar';
import { AVATARS } from '../avatars';
import type { PresenceEntry, Station } from '../types';
import { NowPlaying } from './NowPlaying';
import { HybridVisualizer } from './HybridVisualizer';
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

const CONTROLS_GUTTER_PX = 64;
const CROWD_HARD_CAP = 200;

// Names never drop in this look: the avatar and the name's width are what shrink. The crowd
// simulation separates neighbours by `radius`, so that radius has to cover the name under the
// avatar, not just the avatar itself: otherwise names pile up and clip at the screen edges.
export const HYBRID_AVATAR_MIN = 12;
export const HYBRID_AVATAR_BASE = 44;
export const HYBRID_LABEL_MIN_W = 44;
export const HYBRID_LABEL_MAX_W = 84;
// The simulation pushes neighbours apart below radius * 1.7 * 2 = labelW * 1.19 at this radius.
const LABEL_RADIUS_FRACTION = 0.35;
const SEPARATION_PER_LABEL_W = LABEL_RADIUS_FRACTION * 1.7 * 2;
const MIN_CELL_PX = Math.ceil(HYBRID_LABEL_MIN_W * SEPARATION_PER_LABEL_W);

// The small flower sits behind the DJ, not over the floor. VIZ_* mirror the JSX wrapper below:
// if that wrapper moves, these must move with it.
export const HYBRID_VIZ_SIZE = 176;
const VIZ_CENTER_Y_PX = 141;
const VIZ_CLEARANCE_PX = 6;

// The PA stacks stay on screen at every width in this look (the old floor hid them below 400px),
// so their obstacle rects must exist at every width too. Mirrors the JSX wrappers below.
const PA_TOP_PX = 88;
const PA_ASPECT = 260 / 200;
const OBSTACLE_MARGIN_PX = 12;

function paWidthPx(boxW: number): number {
  if (boxW >= 704) return 210;
  if (boxW >= 640) return 150;
  return 76;
}

export function hybridObstacleRects(boxW: number, boxH: number): Rect[] {
  const w = paWidthPx(boxW);
  const h = w * PA_ASPECT;
  const inset = boxW * 0.005;
  const m = OBSTACLE_MARGIN_PX;
  const top = PA_TOP_PX - m;
  const bottom = Math.min(PA_TOP_PX + h + m, boxH);
  return [
    { x0: inset - m, y0: top, x1: inset + w + m, y1: bottom },
    { x0: boxW - inset - w - m, y0: top, x1: boxW - inset + m, y1: bottom },
  ];
}

export function hybridVizCircle(boxW: number) {
  const size = Math.min(HYBRID_VIZ_SIZE, boxW * 0.55);
  return { cx: boxW / 2, cy: VIZ_CENTER_Y_PX, r: size / 2 + VIZ_CLEARANCE_PX };
}

const REGION_TOP_FRACTION = 0.2;
const REGION_SIDE_MARGIN = 0.03;
// Status row, console and the DJ on the riser: fixed-height elements, so px rather than a fraction.
const STAGE_BOTTOM_PX = 210;

export function hybridCrowdRegion(boxW: number, boxH: number) {
  const x0 = boxW * REGION_SIDE_MARGIN;
  const y0 = Math.max(boxH * REGION_TOP_FRACTION, STAGE_BOTTOM_PX);
  return { x0, y0, x1: boxW - x0, y1: Math.max(y0 + MIN_CELL_PX, boxH - CONTROLS_GUTTER_PX) };
}

function usableFloorPx(boxW: number, boxH: number): number {
  const r = hybridCrowdRegion(boxW, boxH);
  const viz = hybridVizCircle(boxW);
  const blocked = hybridObstacleRects(boxW, boxH).reduce((sum, o) => {
    const w = Math.max(0, Math.min(o.x1, r.x1) - Math.max(o.x0, r.x0));
    const h = Math.max(0, Math.min(o.y1, r.y1) - Math.max(o.y0, r.y0));
    return sum + w * h;
  }, Math.PI * viz.r * viz.r);
  return Math.max(1, (r.x1 - r.x0) * (r.y1 - r.y0) - blocked);
}

export function hybridCrowdCapacity(boxW: number, boxH: number): number {
  return Math.max(1, Math.min(Math.floor(usableFloorPx(boxW, boxH) / (MIN_CELL_PX * MIN_CELL_PX)), CROWD_HARD_CAP));
}

/**
 * Layout for a given crowd size. The avatar and the name's width shrink together as the floor
 * fills; the name itself is always rendered. The region is inset by half a name so the widest
 * label can never be pushed off either side of the screen.
 */
export function hybridLayout(total: number, boxW: number, boxH: number) {
  const per = Math.sqrt(usableFloorPx(boxW, boxH) / Math.max(1, total));
  const labelW = Math.round(clamp(0.7 * per, HYBRID_LABEL_MIN_W, HYBRID_LABEL_MAX_W));
  const size = Math.round(clamp(0.6 * per, HYBRID_AVATAR_MIN, HYBRID_AVATAR_BASE));
  const base = hybridCrowdRegion(boxW, boxH);
  const inset = Math.max(boxW * REGION_SIDE_MARGIN, labelW / 2 + 2);
  return {
    size,
    labelW,
    fontSize: size >= 36 ? 11 : 10,
    radius: Math.max(size / 2, labelW * LABEL_RADIUS_FRACTION),
    region: { x0: inset, y0: base.y0, x1: boxW - inset, y1: base.y1 },
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

  const [, forceTick] = useState(0);
  const now = Date.now();
  const anyCheer = roster.some((e) => isCheering(e.cheerAt, now));
  useEffect(() => {
    if (!anyCheer) return;
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [anyCheer]);

  const cap = hybridCrowdCapacity(box.w, box.h);
  const shown = Math.min(roster.length, cap);
  const tile = hybridLayout(shown, box.w, box.h);
  const overflow = Math.max(0, roster.length - cap);
  const visible = isGhost
    ? GHOST_ENTRIES
    : [...roster]
        .sort((a, b) => (a.deviceId ?? a.uid).localeCompare(b.deviceId ?? b.uid))
        .slice(0, cap);

  const crowdEnv = useMemo<CrowdEnv>(() => ({
    region: tile.region,
    viz: hybridVizCircle(box.w),
    rects: hybridObstacleRects(box.w, box.h),
    radius: tile.radius,
    speed: 26,
  }), [box.w, box.h, tile.region, tile.radius]);
  const nodes = useCrowdMotion(visible.map((e) => e.uid), crowdEnv, visible.length > 0);

  return (
    <div ref={floorRef} className="relative w-full h-full overflow-hidden bg-[#05060f]">
      <div className="absolute inset-0 radio-nebula" aria-hidden="true" />
      <div className="absolute inset-0 radio-stars" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-2/5 radio-aurora" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-1/3 radio-stage-backdrop" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] radio-floor-glow" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] radio-grid" aria-hidden="true" />

      <div
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-[2] pointer-events-none opacity-60"
        style={{ top: VIZ_CENTER_Y_PX }}
        data-testid="psyviz"
      >
        <HybridVisualizer size={Math.min(HYBRID_VIZ_SIZE, box.w * 0.55)} />
      </div>

      <div className="absolute top-[88px] left-[0.5%] z-[8] w-[76px] sm:w-[150px] lg:w-[210px] pointer-events-none">
        <PaStack side="left" />
      </div>
      <div className="absolute top-[88px] right-[0.5%] z-[8] w-[76px] sm:w-[150px] lg:w-[210px] pointer-events-none">
        <PaStack side="right" />
      </div>

      <div className="absolute top-0 inset-x-0 z-10 flex flex-col items-center gap-2 px-4 pt-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 ${live ? 'bg-[#FF0033] pixel-blink' : 'rounded-full bg-[#39405a]'}`}
            aria-hidden="true"
          />
          <span className="pixel text-[10px] text-white/60">{live ? 'On Air' : 'Standby'}</span>
          <span className="pixel text-[10px] text-[#FFB84D] ml-2" data-testid="aboard">
            ABOARD {String(roster.length).padStart(2, '0')}
          </span>
        </div>

        <div className="relative flex items-center gap-3 px-4 sm:px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md radio-booth-glow w-full">
          <Disc3
            className={`w-7 h-7 shrink-0 text-[#26C6DA] ${live ? 'radio-spin' : ''}`}
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <div className="min-w-0 flex flex-col">
            <span className="font-display text-sm text-white tracking-wide truncate">SUBSPACE RESONATOR</span>
            <NowPlaying station={station} nowPlaying={nowPlaying} />
          </div>
        </div>

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
              <span
                data-testid="crowd-name"
                className="font-mono text-white/80 leading-none mt-1 truncate"
                style={{ fontSize: tile.fontSize, maxWidth: tile.labelW }}
              >
                {entry.name.slice(0, 12)}
              </span>
            </div>
          </div>
        );
      })}

      {overflow > 0 && (
        <div className="absolute z-[6] bottom-2 inset-x-0 flex justify-center pointer-events-none">
          <span className="pixel text-[10px] text-white/50">+{overflow} in the crowd</span>
        </div>
      )}
    </div>
  );
}
