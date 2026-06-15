import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { getAvatar } from '../avatars';

interface ChatProps {
  messages: ChatMessage[];
}

export function Chat({ messages }: ChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  return (
    <div className="flex flex-col gap-2 overflow-y-auto flex-1 px-3 py-2" aria-label="Chat messages" aria-live="polite">
      {messages.map((msg) => {
        const avatar = getAvatar(msg.avatar_id);
        return (
          <div key={msg.id} className="flex items-start gap-2 text-sm">
            <span
              className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold mt-0.5"
              style={{ backgroundColor: avatar.color, color: avatar.textColor }}
              aria-hidden="true"
            >
              {avatar.label.slice(0, 2).toUpperCase()}
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-mono text-[11px] text-[#aaa] mr-1">
                {msg.display_name}
              </span>
              {msg.is_host && (
                <span className="font-mono text-[9px] bg-[#7B2FBE] text-white px-1 py-0.5 rounded mr-1 align-middle">
                  HOST
                </span>
              )}
              {/* SECURITY: msg.body is rendered as text content, never as HTML */}
              <span className="font-mono text-white text-[12px] break-words">
                {msg.body}
              </span>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
