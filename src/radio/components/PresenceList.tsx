import type { PresenceEntry } from '../types';
import { getAvatar } from '../avatars';

interface PresenceListProps {
  presenceList: PresenceEntry[];
  count: number;
}

export function PresenceList({ presenceList, count }: PresenceListProps) {
  return (
    <div className="px-3 py-2 border-t border-[#1a1a2e]">
      <p className="font-mono text-[#555] text-[10px] uppercase tracking-widest mb-2">
        {count} {count === 1 ? 'listener' : 'listeners'} online
      </p>
      <div className="flex flex-wrap gap-1">
        {presenceList.slice(0, 20).map((entry) => {
          const avatar = getAvatar(entry.avatarId);
          return (
            <span
              key={entry.uid}
              title={entry.name}
              className="inline-flex items-center gap-1 font-mono text-[10px] text-[#aaa]"
            >
              <span
                className="w-4 h-4 rounded-full inline-block flex-shrink-0"
                style={{ backgroundColor: avatar.color }}
                aria-hidden="true"
              />
              {entry.name}
            </span>
          );
        })}
        {presenceList.length > 20 && (
          <span className="font-mono text-[10px] text-[#555]">
            +{presenceList.length - 20} more
          </span>
        )}
      </div>
    </div>
  );
}
