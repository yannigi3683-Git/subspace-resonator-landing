import { useEffect, useRef } from 'react';
import { Reply } from 'lucide-react';
import type { ChatMessage } from '../types';
import { Avatar } from './Avatar';

interface ChatProps {
  messages: ChatMessage[];
  onReply?: (msg: ChatMessage) => void;
}

export function Chat({ messages, onReply }: ChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  return (
    <div className="flex flex-col gap-2 overflow-y-auto flex-1 px-3 py-2" aria-label="Chat messages" aria-live="polite">
      {messages.map((msg) => {
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
            </div>
            {onReply && (
              <button
                type="button"
                onClick={() => onReply(msg)}
                aria-label={`Reply to ${msg.display_name}`}
                className="flex-shrink-0 mt-0.5 p-1 text-[#666] rounded opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[#a875d8] transition-opacity md:opacity-0 max-md:opacity-60"
              >
                <Reply size={14} />
              </button>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
