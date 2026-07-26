import { useEffect, useRef, useState } from 'react';
import { Reply, Shield, SmilePlus } from 'lucide-react';
import type { ChatMessage } from '../types';
import type { ReactionSummary } from '../chatRules';
import { REACTIONS } from '../emojiSet';
import { Avatar } from './Avatar';

export interface ChatModeration {
  onDelete: (msg: ChatMessage) => void;
  onKick: (msg: ChatMessage) => void;
  onBan: (msg: ChatMessage) => void;
}

interface ChatProps {
  messages: ChatMessage[];
  onReply?: (msg: ChatMessage) => void;
  reactions?: Record<string, ReactionSummary[]>;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  // Present only for the host, who moderates from inside the room. Absent for every listener,
  // so the controls exist in nobody else's DOM.
  moderation?: ChatModeration;
}

export function Chat({ messages, onReply, reactions, onToggleReaction, moderation }: ChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [reactOpenFor, setReactOpenFor] = useState<string | null>(null);
  const [modOpenFor, setModOpenFor] = useState<string | null>(null);
  // Ban is irreversible from the listener's side, so it takes a second deliberate tap.
  const [banArmedFor, setBanArmedFor] = useState<string | null>(null);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  return (
    <div className="flex flex-col gap-2 overflow-y-auto flex-1 px-3 py-2" aria-label="Chat messages" aria-live="polite">
      {messages.map((msg) => {
        const pills = reactions?.[msg.id] ?? [];
        return (
          <div key={msg.id} className="group flex items-start gap-2 text-sm">
            <Avatar
              avatarId={msg.avatar_id}
              size={24}
              label={msg.display_name}
              className="flex-shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              {msg.reply_to_name && (
                <div className="border-l-2 border-[#7B2FBE]/60 pl-2 mb-0.5 text-[11px] text-[#888] truncate">
                  <span className="text-[#a875d8]">{msg.reply_to_name}</span>
                  {msg.reply_to_body ? <span className="ml-1">{msg.reply_to_body}</span> : null}
                </div>
              )}
              <span className="font-mono text-[13px] text-[#aaa] mr-1">
                {msg.display_name}
              </span>
              {msg.is_host && (
                <span className="font-mono text-[10px] bg-[#7B2FBE] text-white px-1 py-0.5 rounded mr-1 align-middle">
                  HOST
                </span>
              )}
              {/* SECURITY: msg.body is rendered as text content, never as HTML */}
              {/* dir="auto" flips Hebrew to RTL per-message; Latin stays LTR (native, no detection) */}
              <span dir="auto" className="font-mono text-white text-[14px] break-words">
                {msg.body}
              </span>

              {onToggleReaction && (pills.length > 0 || reactOpenFor === msg.id) && (
                <div className="flex flex-wrap items-center gap-1 mt-1">
                  {pills.map((p) => (
                    <button
                      key={p.emoji}
                      type="button"
                      onClick={() => onToggleReaction(msg.id, p.emoji)}
                      aria-label={`${p.mine ? 'Remove' : 'Add'} ${p.emoji} reaction (${p.count})`}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors ${
                        p.mine
                          ? 'bg-[#7B2FBE]/30 border-[#7B2FBE] text-white'
                          : 'bg-white/5 border-white/10 text-[#ccc] hover:border-[#7B2FBE]'
                      }`}
                    >
                      <span>{p.emoji}</span>
                      <span className="font-mono">{p.count}</span>
                    </button>
                  ))}
                  {reactOpenFor === msg.id &&
                    REACTIONS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          onToggleReaction(msg.id, e);
                          setReactOpenFor(null);
                        }}
                        aria-label={`React with ${e}`}
                        className="w-6 h-6 flex items-center justify-center rounded-full text-sm hover:bg-[#7B2FBE]/40"
                      >
                        {e}
                      </button>
                    ))}
                </div>
              )}

              {moderation && modOpenFor === msg.id && (
                <div className="mt-1.5 flex flex-col gap-1 border border-[#ff6b6b]/30 rounded p-1.5">
                  <button
                    type="button"
                    onClick={() => { moderation.onDelete(msg); setModOpenFor(null); }}
                    className="w-full min-h-[44px] font-mono text-[11px] tracking-widest text-white border border-white/20 hover:bg-white/10 transition-colors"
                  >
                    DELETE MESSAGE
                  </button>
                  <button
                    type="button"
                    onClick={() => { moderation.onKick(msg); setModOpenFor(null); }}
                    className="w-full min-h-[44px] font-mono text-[11px] tracking-widest text-[#ffcc66] border border-[#ffcc66]/40 hover:bg-[#ffcc66]/10 transition-colors"
                  >
                    KICK {msg.display_name}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (banArmedFor === msg.id) {
                        moderation.onBan(msg);
                        setBanArmedFor(null);
                        setModOpenFor(null);
                      } else {
                        setBanArmedFor(msg.id);
                      }
                    }}
                    className="w-full min-h-[44px] font-mono text-[11px] tracking-widest text-[#ff6b6b] border border-[#ff6b6b]/40 hover:bg-[#ff6b6b]/10 transition-colors"
                  >
                    {banArmedFor === msg.id ? 'TAP AGAIN TO BAN' : `BAN ${msg.display_name}`}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 mt-0.5 flex flex-col items-center gap-0.5">
              {moderation && (
                <button
                  type="button"
                  onClick={() => {
                    setModOpenFor((cur) => (cur === msg.id ? null : msg.id));
                    setBanArmedFor(null);
                  }}
                  aria-label={`Moderate ${msg.display_name}'s message`}
                  aria-expanded={modOpenFor === msg.id}
                  data-testid="moderate-message"
                  className="w-11 h-11 flex items-center justify-center text-[#ff6b6b]/70 hover:text-[#ff6b6b] transition-colors"
                >
                  <Shield size={14} />
                </button>
              )}
              {onReply && (
                <button
                  type="button"
                  onClick={() => onReply(msg)}
                  aria-label={`Reply to ${msg.display_name}`}
                  className="p-1 text-[#666] rounded opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#a875d8] transition-opacity max-md:opacity-60"
                >
                  <Reply size={14} />
                </button>
              )}
              {onToggleReaction && (
                <button
                  type="button"
                  onClick={() => setReactOpenFor((cur) => (cur === msg.id ? null : msg.id))}
                  aria-label={`React to ${msg.display_name}'s message`}
                  aria-expanded={reactOpenFor === msg.id}
                  className="p-1 text-[#666] rounded opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#a875d8] transition-opacity max-md:opacity-60"
                >
                  <SmilePlus size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
