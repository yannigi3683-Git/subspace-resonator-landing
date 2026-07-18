import { describe, it, expect } from 'vitest';
import { validateMessage, formatSlowModeRemaining, chatReloadFloor, buildReplySnippet, aggregateReactions, isAllowedGifUrl } from './chatRules';

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

describe('buildReplySnippet', () => {
  it('returns the body unchanged when short', () => {
    expect(buildReplySnippet({ body: 'hey there' })).toBe('hey there');
  });

  it('trims surrounding whitespace', () => {
    expect(buildReplySnippet({ body: '  padded  ' })).toBe('padded');
  });

  it('truncates a long body to 140 chars with an ellipsis', () => {
    const snip = buildReplySnippet({ body: 'x'.repeat(300) });
    expect(snip.length).toBe(140);
    expect(snip.endsWith('…')).toBe(true);
  });

  it('returns "GIF" for a gif message regardless of body', () => {
    expect(buildReplySnippet({ body: 'a cat', gif_url: 'https://media.tenor.com/abc.gif' })).toBe('GIF');
  });
});

describe('aggregateReactions', () => {
  it('returns an empty map for no rows', () => {
    expect(aggregateReactions([], 'me')).toEqual({});
  });

  it('counts repeated emoji on the same message', () => {
    const rows = [
      { message_id: 'm1', emoji: '🔥', uid: 'a' },
      { message_id: 'm1', emoji: '🔥', uid: 'b' },
    ];
    expect(aggregateReactions(rows, 'me')).toEqual({ m1: [{ emoji: '🔥', count: 2, mine: false }] });
  });

  it('flags mine when my uid is among the reactors', () => {
    const rows = [
      { message_id: 'm1', emoji: '❤️', uid: 'me' },
      { message_id: 'm1', emoji: '❤️', uid: 'b' },
    ];
    expect(aggregateReactions(rows, 'me').m1).toEqual([{ emoji: '❤️', count: 2, mine: true }]);
  });

  it('separates by message and by emoji', () => {
    const rows = [
      { message_id: 'm1', emoji: '🔥', uid: 'a' },
      { message_id: 'm1', emoji: '👍', uid: 'a' },
      { message_id: 'm2', emoji: '🔥', uid: 'a' },
    ];
    const out = aggregateReactions(rows, 'me');
    expect(out.m1).toHaveLength(2);
    expect(out.m2).toEqual([{ emoji: '🔥', count: 1, mine: false }]);
  });
});

describe('isAllowedGifUrl (security boundary)', () => {
  it('accepts a Tenor media host over https', () => {
    expect(isAllowedGifUrl('https://media.tenor.com/abc/cat.gif')).toBe(true);
    expect(isAllowedGifUrl('https://media1.tenor.com/abc/cat.gif')).toBe(true);
  });

  it('rejects non-Tenor hosts', () => {
    expect(isAllowedGifUrl('https://evil.com/x.gif')).toBe(false);
    expect(isAllowedGifUrl('https://media.tenor.com.evil.com/x.gif')).toBe(false);
    expect(isAllowedGifUrl('https://media.tenor.com@evil.com/x.gif')).toBe(false);
  });

  it('rejects non-https and dangerous schemes', () => {
    expect(isAllowedGifUrl('http://media.tenor.com/x.gif')).toBe(false);
    expect(isAllowedGifUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedGifUrl('data:image/gif;base64,AAAA')).toBe(false);
    expect(isAllowedGifUrl('not a url')).toBe(false);
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
