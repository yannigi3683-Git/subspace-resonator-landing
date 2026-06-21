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

export function formatSlowModeRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${s}s`;
}

// Earliest created_at to reload chat from. Chat is scoped to the current broadcast:
// it persists across a page refresh (firstSeen of this session) but resets when the
// broadcast ends (a new session has no firstSeen) or when the date changes (the
// start-of-today floor advances past an older firstSeen).
export function chatSinceFloor(firstSeen: string | null, now: number): string {
  const d = new Date(now);
  const todayMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  if (!firstSeen) return new Date(now).toISOString();
  return firstSeen > todayMidnight ? firstSeen : todayMidnight;
}
