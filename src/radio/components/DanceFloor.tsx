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

interface DanceFloorProps {
  presenceList: PresenceEntry[];
  station: Station | null;
  uid: string;
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
}: DanceFloorProps) {
  const visible = presenceList.length > 0 ? presenceList.slice(0, 150) : GHOST_ENTRIES;
  const isGhost = presenceList.length === 0;
  const live = station?.mode === 'live';

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#05060f]">
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
      <div className="absolute top-[6%] left-[0.5%] z-[8] hidden min-[400px]:block w-[72px] sm:w-[100px] lg:w-[140px] pointer-events-none">
        <PaStack side="left" />
      </div>
      <div className="absolute top-[6%] right-[0.5%] z-[8] hidden min-[400px]:block w-[72px] sm:w-[100px] lg:w-[140px] pointer-events-none">
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
        // Keep the crowd in the lower floor band, clear of the central visualizer.
        const px = 12 + clamp(entry.position.x, 0, 100) * 0.76;
        const py = 74 + clamp(entry.position.y, 0, 100) * 0.21;
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
