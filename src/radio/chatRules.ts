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
