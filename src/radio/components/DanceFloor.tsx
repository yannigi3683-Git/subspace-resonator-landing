import { Disc3 } from 'lucide-react';
import { Avatar } from './Avatar';
import { AVATARS } from '../avatars';
import type { PresenceEntry, Station } from '../types';
import { NowPlaying } from './NowPlaying';

function hashUid(uid: string): number {
  let h = 5381;
  for (let i = 0; i < uid.length; i++) h = ((h << 5) + h + uid.charCodeAt(i)) >>> 0;
  return h;
}

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

export function DanceFloor({ presenceList, station, uid }: DanceFloorProps) {
  const visible = presenceList.length > 0 ? presenceList.slice(0, 150) : GHOST_ENTRIES;
  const isGhost = presenceList.length === 0;
  const live = station?.mode === 'live';

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#05060f]">
      {/* Atmosphere layers (decorative) */}
      <div className="absolute inset-0 radio-nebula" aria-hidden="true" />
      <div className="absolute inset-0 radio-stars" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-2/5 radio-aurora" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] radio-floor-glow" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] radio-grid" aria-hidden="true" />

      {/* Stage / DJ booth */}
      <div className="absolute top-0 inset-x-0 z-10 flex flex-col items-center gap-2 px-4 pt-4">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${live ? 'bg-red-500 radio-pulse' : 'bg-[#39405a]'}`}
            aria-hidden="true"
          />
          <span className="font-mono text-[10px] tracking-[0.4em] text-white/60 uppercase">
            {live ? 'On Air' : 'Standby'}
          </span>
        </div>

        <div className="relative flex items-center gap-3 px-4 sm:px-5 py-3 rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md radio-booth-glow max-w-full">
          <Disc3
            className={`w-8 h-8 shrink-0 text-[#26C6DA] ${live ? 'radio-spin' : ''}`}
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
            <div className="ml-1 hidden sm:flex items-end gap-[3px] h-8 w-12 shrink-0" aria-hidden="true">
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
      </div>

      {/* Virtual dancefloor crowd */}
      <div className="absolute left-0 right-0" style={{ top: '34%', height: '64%' }}>
        {visible.map((entry) => {
          const isSelf = entry.uid === uid;
          const h = hashUid(entry.uid);
          const delay = `${(h % 20) * 120}ms`;
          const duration = `${3 + (h % 6) * 0.4}s`;
          return (
            <div
              key={entry.uid}
              className="absolute flex flex-col items-center"
              style={{
                left: `${entry.position.x}%`,
                top: `${entry.position.y}%`,
                transform: 'translate(-50%, -50%)',
                opacity: isGhost ? 0.3 : 1,
              }}
            >
              <div
                className={`radio-bob ${isSelf ? 'rounded-full ring-2 ring-white/80 ring-offset-2 ring-offset-transparent' : ''}`}
                style={{ animationDelay: delay, animationDuration: duration }}
              >
                <Avatar avatarId={entry.avatarId} size={isSelf ? 42 : 34} label={entry.name} />
              </div>
              <span className="font-mono text-white/75 text-[10px] leading-none mt-1.5 max-w-[72px] truncate">
                {entry.name.slice(0, 12)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
