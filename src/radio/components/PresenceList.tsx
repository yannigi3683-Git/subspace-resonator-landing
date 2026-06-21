import type { PresenceEntry } from '../types';
import { Avatar } from './Avatar';

interface PresenceListProps {
  presenceList: PresenceEntry[];
  count: number;
}

export function PresenceList({ presenceList, count }: PresenceListProps) {
  return (
    <div className="px-3 py-2 border-t border-[#8800FF]">
      <p className="pixel text-[10px] text-[#888899] mb-2">
        {count} {count === 1 ? 'listener' : 'listeners'} online
      </p>
      <div className="flex flex-wrap gap-1">
        {presenceList.slice(0, 20).map((entry) => (
          <span
            key={entry.uid}
            title={entry.name}
            className="inline-flex items-center gap-1 pixel text-[10px] text-[#888899]"
          >
            <Avatar avatarId={entry.avatarId} size={16} label={entry.name} className="flex-shrink-0" />
            {entry.name}
          </span>
        ))}
        {presenceList.length > 20 && (
          <span className="pixel text-[10px] text-[#555]">
            +{presenceList.length - 20} more
          </span>
        )}
      </div>
    </div>
  );
}
