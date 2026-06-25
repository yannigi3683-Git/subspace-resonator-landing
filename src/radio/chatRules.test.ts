import { describe, it, expect } from 'vitest';
import { validateMessage, formatSlowModeRemaining, chatReloadFloor } from './chatRules';

describe('validateMessage', () => {
  it('rejects empty string', () => {
    expect(validateMessage('').valid).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    expect(validateMessage('   ').valid).toBe(false);
  });

  it('accepts 1-char message', () => {
    expect(validateMessage('a').valid).toBe(true);
  });

  it('accepts exactly 500 chars', () => {
    expect(validateMessage('x'.repeat(500)).valid).toBe(true);
  });

  it('rejects 501 chars', () => {
    const result = validateMessage('x'.repeat(501));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('500');
  });

  it('accepts HTML-like string as valid text (plain-text enforcement is at render layer)', () => {
    expect(validateMessage('<img src=x onerror=alert(1)>').valid).toBe(true);
  });
});

describe('formatSlowModeRemaining', () => {
  it('converts ms to ceiling seconds with s suffix', () => {
    expect(formatSlowModeRemaining(3000)).toBe('3s');
    expect(formatSlowModeRemaining(3001)).toBe('4s');
    expect(formatSlowModeRemaining(1)).toBe('1s');
  });
});

describe('chatReloadFloor', () => {
  const now = new Date(2026, 5, 21, 15, 0, 0).getTime(); // local time, TZ-stable

  it('floors to the broadcast start time when present (mid-broadcast joiner sees full chat)', () => {
    const startedAt = new Date(2026, 5, 21, 14, 30, 0).toISOString();
    expect(chatReloadFloor(startedAt, now)).toBe(startedAt);
  });

  it('falls back to now when startedAt is null (chat starts empty)', () => {
    expect(chatReloadFloor(null, now)).toBe(new Date(now).toISOString());
  });

  it('falls back to now when startedAt is undefined (pre-startedAt session)', () => {
    expect(chatReloadFloor(undefined, now)).toBe(new Date(now).toISOString());
  });
});
