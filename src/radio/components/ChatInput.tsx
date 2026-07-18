import { useState, useCallback, useRef, useEffect } from 'react';
import { Smile, X } from 'lucide-react';
import { formatSlowModeRemaining } from '../chatRules';
import { EMOJI } from '../emojiSet';
import type { ChatMessage } from '../types';

interface ChatInputProps {
  onSend: (body: string) => Promise<void>;
  sending: boolean;
  sendError: string | null;
  slowModeRemainingMs?: number;
  disabled?: boolean;
  replyTo?: ChatMessage | null;
  onCancelReply?: () => void;
}

const MAX_BODY = 500;

export function ChatInput({ onSend, sending, sendError, slowModeRemainingMs = 0, disabled = false, replyTo = null, onCancelReply }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);

  // Focus the composer when the user starts a reply.
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  const isBlocked = slowModeRemainingMs > 0 || disabled || sending;

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || isBlocked) return;
    await onSend(trimmed);
    setValue('');
  }, [value, isBlocked, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const insertEmoji = useCallback((emoji: string) => {
    const el = textareaRef.current;
    setValue((prev) => {
      const start = el?.selectionStart ?? prev.length;
      const end = el?.selectionEnd ?? prev.length;
      const next = (prev.slice(0, start) + emoji + prev.slice(end)).slice(0, MAX_BODY);
      // Restore caret after React commits the new value.
      requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        const caret = Math.min(start + emoji.length, next.length);
        el.setSelectionRange(caret, caret);
      });
      return next;
    });
  }, []);

  // Close the emoji popover on outside click or Escape.
  useEffect(() => {
    if (!emojiOpen) return;
    const onDown = (e: MouseEvent) => {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEmojiOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [emojiOpen]);

  return (
    <div className="px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] border-t border-[#1a1a2e]">
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 pl-2 border-l-2 border-[#7B2FBE] text-[11px] min-w-0">
          <span className="text-[#888] shrink-0">Replying to</span>
          <span className="text-[#a875d8] truncate">{replyTo.display_name}</span>
          <button
            type="button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="ml-auto shrink-0 p-1 text-[#888] hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex gap-2 items-end">
        <div ref={emojiWrapRef} className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setEmojiOpen((o) => !o)}
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
            className="flex items-center justify-center bg-[#1a0030] border border-[#333] text-[#aaa] rounded-lg min-w-[44px] min-h-[44px] disabled:opacity-40 hover:text-white hover:border-[#7B2FBE] transition-colors"
          >
            <Smile size={20} />
          </button>
          {emojiOpen && (
            <div
              role="menu"
              aria-label="Emoji picker"
              className="absolute bottom-full left-0 mb-2 z-20 w-[280px] max-h-[220px] overflow-y-auto bg-[#12001f] border border-[#333] rounded-lg p-2 grid grid-cols-8 gap-0.5 shadow-xl"
            >
              {EMOJI.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => insertEmoji(e)}
                  aria-label={`Emoji ${e}`}
                  className="text-xl leading-none w-8 h-8 flex items-center justify-center rounded hover:bg-[#7B2FBE]/40"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_BODY}
          rows={1}
          disabled={disabled}
          placeholder={disabled ? 'Chat is locked' : 'Say something...'}
          aria-label="Chat message"
          dir="auto"
          className="flex-1 bg-[#1a0030] border border-[#333] text-white font-mono text-base px-3 py-2 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-[#7B2FBE] disabled:opacity-40 placeholder:text-[#555]"
        />
        <button
          type="button"
          disabled={isBlocked || !value.trim()}
          onClick={handleSend}
          aria-label="Send message"
          className="px-4 py-2 bg-[#7B2FBE] text-white font-mono text-xs font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#9B4FDE] min-w-[44px] min-h-[44px] transition-colors"
        >
          {sending ? '...' : 'SEND'}
        </button>
      </div>
      {slowModeRemainingMs > 0 && (
        <p className="font-mono text-[#888] text-[10px] mt-1">
          Slow mode: {formatSlowModeRemaining(slowModeRemainingMs)}
        </p>
      )}
      {sendError && (
        <p role="alert" className="font-mono text-[#ff6b6b] text-[10px] mt-1">
          {sendError}
        </p>
      )}
    </div>
  );
}
