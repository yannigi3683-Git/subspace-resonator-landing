import { Disc3 } from 'lucide-react';
import { Avatar } from './Avatar';
import { AVATARS } from '../avatars';
import type { PresenceEntry, Station } from '../types';
import { NowPlaying } from './NowPlaying';
import { Visualizer } from './Visualizer';
import { ButterchurnViz } from './ButterchurnViz';

function hashUid(uid: string): number {
  let h = 5381;
  for (let i = 0; i < uid.length; i++) h = ((h << 5) + h + uid.charCodeAt(i)) >>> 0;
  return h;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

interface DanceFloorProps {
  presenceList: PresenceEntry[];
  station: Station | null;
  uid: string;
  getFrequencyData?: () => Uint8Array | null;
  getAudioContext?: () => AudioContext | null;
  getAudioSource?: () => AudioNode | null;
  playing?: boolean;
}

const GHOST_ENTRIES: PresenceEntry[] = [
  { uid: 'ghost-1', name: '???', avatarId: AVATARS[0].id, position: { x: 30, y: 40 } },
  { uid: 'ghost-2', name: '???', avatarId: AVATARS[3].id, position: { x: 50, y: 62 } },
  { uid: 'ghost-3', name: '???', avatarId: AVATARS[7].id, position: { x: 70, y: 45 } },
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
  getFrequencyData,
  getAudioContext,
  getAudioSource,
  playing,
}: DanceFloorProps) {
  const visible = presenceList.length > 0 ? presenceList.slice(0, 150) : GHOST_ENTRIES;
  const isGhost = presenceList.length === 0;
  const live = station?.mode === 'live';
  const reduced =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const useButterchurn = !reduced && !!getAudioContext && !!getAudioSource;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#05060f]">
      {/* Atmosphere layers (decorative) */}
      <div className="absolute inset-0 radio-nebula" aria-hidden="true" />
      <div className="absolute inset-0 radio-stars" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-2/5 radio-aurora" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-1/3 radio-stage-backdrop" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] radio-floor-glow" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] radio-grid" aria-hidden="true" />

      {/* Full-bleed MilkDrop (Butterchurn) visualizer — the main psychedelic backdrop */}
      {useButterchurn && (
        <div className="absolute inset-0 z-[1] pointer-events-none" data-testid="butterchurn">
          <ButterchurnViz
            getAudioContext={getAudioContext!}
            getAudioSource={getAudioSource!}
            active={!!playing}
          />
        </div>
      )}

      {/* Lightweight radial visualizer — fallback when MilkDrop can't run (reduced motion) */}
      {!useButterchurn && getFrequencyData && (
        <div
          className="absolute left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2 w-[72vmin] h-[72vmin] max-w-[520px] max-h-[520px] z-[2] pointer-events-none"
          data-testid="visualizer"
        >
          <Visualizer getFrequencyData={getFrequencyData} />
        </div>
      )}

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

      {/* ── STAGE ────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-10 flex flex-col items-center gap-2 px-4 pt-3">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${live ? 'bg-red-500 radio-pulse' : 'bg-[#39405a]'}`}
            aria-hidden="true"
          />
          <span className="font-mono text-[10px] tracking-[0.4em] text-white/60 uppercase">
            {live ? 'On Air' : 'Standby'}
          </span>
        </div>

        {/* Decks / now-playing console */}
        <div className="relative flex items-center gap-3 px-4 sm:px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md radio-booth-glow max-w-full">
          <Disc3
            className={`w-7 h-7 shrink-0 text-[#26C6DA] ${live ? 'radio-spin' : ''}`}
            aria-hidden="true"
            strokeWidth={1.5}
          />
          <div className="min-w-0 flex flex-col">
            <span className="font-display text-sm text-white tracking-wide truncate">
              SUBSPACE RESONATOR
            </span>
            <NowPlaying station={station} />
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
          <span className="font-mono text-[10px] tracking-[0.25em] text-[#26C6DA] mt-0.5">
            {live ? 'LIVE DJ' : 'OFF AIR'}
          </span>
        </div>
      </div>

      {/* ── DANCEFLOOR CROWD ─────────────────────────────────── */}
      {visible.map((entry) => {
        const isSelf = entry.uid === uid;
        const h = hashUid(entry.uid);
        const delay = `${(h % 20) * 120}ms`;
        const duration = `${3 + (h % 6) * 0.4}s`;
        // Cluster the crowd in the lower-centre floor band so it never hugs the edges.
        const px = 14 + clamp(entry.position.x, 0, 100) * 0.72;
        const py = 52 + clamp(entry.position.y, 0, 100) * 0.42;
        return (
          <div
            key={entry.uid}
            className="absolute z-[5] flex flex-col items-center"
            style={{
              left: `${px}%`,
              top: `${py}%`,
              transform: 'translate(-50%, -50%)',
              opacity: isGhost ? 0.3 : 1,
            }}
          >
            <div
              className={`radio-bob ${isSelf ? 'rounded-full ring-2 ring-white/80 ring-offset-2 ring-offset-transparent' : ''}`}
              style={{ animationDelay: delay, animationDuration: duration }}
            >
              <Avatar avatarId={entry.avatarId} size={isSelf ? 56 : 44} label={entry.name} />
            </div>
            <span className="font-mono text-white/80 text-[11px] leading-none mt-1.5 max-w-[84px] truncate">
              {entry.name.slice(0, 14)}
            </span>
          </div>
        );
      })}
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
