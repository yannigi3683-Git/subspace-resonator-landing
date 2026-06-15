import { useState, useCallback } from 'react';
import { formatSlowModeRemaining } from '../chatRules';

interface ChatInputProps {
  onSend: (body: string) => Promise<void>;
  sending: boolean;
  sendError: string | null;
  slowModeRemainingMs?: number;
  disabled?: boolean;
}

export function ChatInput({ onSend, sending, sendError, slowModeRemainingMs = 0, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('');

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

  return (
    <div className="px-3 py-2 border-t border-[#1a1a2e]">
      <div className="flex gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
          rows={1}
          disabled={isBlocked}
          placeholder={disabled ? 'Chat is locked' : 'Say something...'}
          aria-label="Chat message"
          className="flex-1 bg-[#1a0030] border border-[#333] text-white font-mono text-sm px-3 py-2 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-[#7B2FBE] disabled:opacity-40 placeholder:text-[#555]"
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
