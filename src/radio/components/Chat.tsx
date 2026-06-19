import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { Avatar } from './Avatar';

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
        return (
          <div key={msg.id} className="flex items-start gap-2 text-sm">
            <Avatar
              avatarId={msg.avatar_id}
              size={24}
              label={msg.display_name}
              className="flex-shrink-0 mt-0.5"
            />
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
