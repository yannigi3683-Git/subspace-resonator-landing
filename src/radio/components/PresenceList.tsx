import type { PresenceEntry } from '../types';
import { Avatar } from './Avatar';

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
        {presenceList.slice(0, 20).map((entry) => (
          <span
            key={entry.uid}
            title={entry.name}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#aaa]"
          >
            <Avatar avatarId={entry.avatarId} size={16} label={entry.name} className="flex-shrink-0" />
            {entry.name}
          </span>
        ))}
        {presenceList.length > 20 && (
          <span className="font-mono text-[10px] text-[#555]">
            +{presenceList.length - 20} more
          </span>
        )}
      </div>
    </div>
  );
}
