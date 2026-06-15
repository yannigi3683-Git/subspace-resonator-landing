import { describe, it, expect } from 'vitest';
import { validateMessage, formatSlowModeRemaining } from './chatRules';

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
