const MAX_BODY = 500;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateMessage(body: string): ValidationResult {
  const trimmed = body.trim();
  if (trimmed.length === 0) return { valid: false, error: 'Message cannot be empty' };
  if (trimmed.length > MAX_BODY) return { valid: false, error: `Message too long (max ${MAX_BODY} chars)` };
  return { valid: true };
}

const SNIPPET_MAX = 140;

// Denormalized quoted-reply preview stored on the replying message, so rendering a
// reply needs no join and survives even when the parent scrolls out of the client window.
export function buildReplySnippet(msg: { body: string; gif_url?: string | null }): string {
  if (msg.gif_url) return 'GIF';
  const b = msg.body.trim();
  return b.length > SNIPPET_MAX ? b.slice(0, SNIPPET_MAX - 1) + '…' : b;
}

export function formatSlowModeRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${s}s`;
}

// Earliest created_at to reload chat from = the current broadcast's start time, so a
// listener who joins mid-broadcast sees the whole broadcast's chat (not an empty box).
// Falls back to "now" when the broadcast has no recorded start (a session published
// before startedAt was tracked) — same as the old empty-on-join behaviour, self-heals
// on the next go-live.
export function chatReloadFloor(startedAt: string | null | undefined, now: number): string {
  return startedAt ?? new Date(now).toISOString();
}
