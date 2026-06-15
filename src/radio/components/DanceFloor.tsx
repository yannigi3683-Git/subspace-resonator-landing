import { getAvatar, AVATARS } from '../avatars';
import type { PresenceEntry, Station } from '../types';
import { NowPlaying } from './NowPlaying';
import liveAlphaUrl from '../../assets/live-alpha.webp';

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
  { uid: 'ghost-2', name: '???', avatarId: AVATARS[3].id, position: { x: 50, y: 60 } },
  { uid: 'ghost-3', name: '???', avatarId: AVATARS[7].id, position: { x: 70, y: 45 } },
];

export function DanceFloor({ presenceList, station, uid }: DanceFloorProps) {
  const visible = presenceList.length > 0 ? presenceList.slice(0, 150) : GHOST_ENTRIES;
  const isGhost = presenceList.length === 0;

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-black"
      style={{ backgroundImage: `url(${liveAlphaUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Stage strip - top 22% */}
      <div className="absolute top-0 left-0 right-0 bg-black/60 border-b border-[#1a1a2e]" style={{ height: '22%' }}>
        <div className="flex flex-col items-center justify-center h-full gap-1 px-4">
          <span className="font-mono text-white/50 text-[10px] tracking-widest uppercase">
            Subspace Radio Live
          </span>
          <NowPlaying station={station} />
          {station?.mode === 'live' && (
            <span className="font-mono text-[#7B2FBE] text-[10px] tracking-wide">
              DJ BOOTH - ON AIR
            </span>
          )}
        </div>
      </div>

      <div className="absolute left-0 right-0" style={{ top: '22%', height: '78%' }}>
        {visible.map((entry) => {
          const avatar = getAvatar(entry.avatarId);
          const isSelf = entry.uid === uid;
          const delay = `${(hashUid(entry.uid) % 20) * 100}ms`;
          return (
            <div
              key={entry.uid}
              className="absolute flex flex-col items-center radio-dance"
              style={{
                left: `${entry.position.x}%`,
                top: `${entry.position.y}%`,
                transform: 'translate(-50%, -50%)',
                animationDelay: delay,
                opacity: isGhost ? 0.25 : 1,
              }}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-[9px] font-bold ${isSelf ? 'ring-1 ring-white' : ''}`}
                style={{ backgroundColor: avatar.color, color: avatar.textColor }}
                title={entry.name}
              >
                {avatar.label.slice(0, 2).toUpperCase()}
              </span>
              <span className="font-mono text-white/70 text-[10px] leading-none mt-0.5 max-w-[48px] truncate">
                {entry.name.slice(0, 8)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
