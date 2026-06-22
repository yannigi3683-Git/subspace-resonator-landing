import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { PresenceEntry } from '../types';
import { Avatar } from './Avatar';
import { AVATARS } from '../avatars';

interface PresenceListProps {
  presenceList: PresenceEntry[];
  count: number;
  uid?: string;
  onRename?: (name: string, avatarId: string) => void;
}

export function PresenceList({ presenceList, count, uid, onRename }: PresenceListProps) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftAvatar, setDraftAvatar] = useState('');
  const [nameError, setNameError] = useState('');

  const ownEntry = uid ? presenceList.find(e => e.uid === uid) : null;
  const otherEntries = uid ? presenceList.filter(e => e.uid !== uid) : presenceList;

  function openEdit() {
    setDraftName(ownEntry?.name ?? '');
    setDraftAvatar(ownEntry?.avatarId ?? '');
    setNameError('');
    setEditing(true);
  }

  function handleSave() {
    if (draftName.trim().length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    onRename?.(draftName.trim(), draftAvatar);
    setEditing(false);
  }

  function handleCancel() {
    setEditing(false);
  }

  return (
    <div className="px-3 py-2 border-t border-[#1a1a2e]">
      <p className="font-mono text-[#555] text-[10px] uppercase tracking-widest mb-2">
        {count} {count === 1 ? 'listener' : 'listeners'} online
      </p>

      {ownEntry && !editing && (
        <div className="flex items-center gap-2 mb-2">
          <Avatar avatarId={ownEntry.avatarId} size={20} label={ownEntry.name} className="flex-shrink-0" />
          <span className="font-mono text-[10px] text-white/70 flex-1 truncate">{ownEntry.name}</span>
          <button
            type="button"
            onClick={openEdit}
            aria-label="Edit your identity"
            className="w-11 h-11 flex items-center justify-center text-white/40 hover:text-white/80 transition-colors shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {editing && (
        <div className="mb-2 space-y-2">
          <input
            type="text"
            value={draftName}
            onChange={e => { setDraftName(e.target.value); setNameError(''); }}
            maxLength={24}
            placeholder="Your name"
            className="w-full bg-transparent border border-white/20 rounded px-2 py-1.5 font-mono text-xs text-white focus:outline-none focus:border-white/40"
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
            autoFocus
          />
          {nameError && (
            <p className="font-mono text-[10px] text-[#ff6b6b]">{nameError}</p>
          )}
          <div className="flex gap-1 overflow-x-auto py-1">
            {AVATARS.map(av => (
              <button
                key={av.id}
                type="button"
                onClick={() => setDraftAvatar(av.id)}
                aria-label={av.label}
                aria-pressed={draftAvatar === av.id}
                className={`shrink-0 rounded-full p-0.5 transition-opacity ${draftAvatar === av.id ? 'ring-1 ring-white/60 opacity-100' : 'opacity-50 hover:opacity-80'}`}
              >
                <Avatar avatarId={av.id} size={24} label={av.label} glow={false} />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 font-mono text-[10px] tracking-widest border border-white/30 min-h-[44px] hover:bg-white/10 transition-colors"
            >
              SAVE
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 font-mono text-[10px] tracking-widest border border-white/15 text-white/50 min-h-[44px] hover:bg-white/5 transition-colors"
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {otherEntries.slice(0, 20).map((entry) => (
          <span
            key={entry.uid}
            title={entry.name}
            className="inline-flex items-center gap-1.5 font-mono text-[10px] text-[#aaa]"
          >
            <Avatar avatarId={entry.avatarId} size={16} label={entry.name} className="flex-shrink-0" />
            {entry.name}
          </span>
        ))}
        {otherEntries.length > 20 && (
          <span className="font-mono text-[10px] text-[#555]">
            +{otherEntries.length - 20} more
          </span>
        )}
      </div>
    </div>
  );
}
