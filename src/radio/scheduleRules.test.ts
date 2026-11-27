import { describe, it, expect } from 'vitest';
import {
  formatCountdown,
  standbyState,
  suggestTitle,
  validateShow,
  formatShowTime,
  hostTimePreview,
  formatRelative,
  wallTimeToMs,
  msToWallTime,
  showToMarkAired,
  type Show,
} from './scheduleRules';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const T = Date.UTC(2026, 10, 29, 20, 0); // Sun 29 Nov 2026, 22:00 Israel
const iso = (ms: number) => new Date(ms).toISOString();
const show = (id: string, startMs: number, extra: Partial<Show> = {}): Show => ({ id, title: id, starts_at: iso(startMs), ...extra });

describe('formatCountdown', () => {
  it('shows 00:00 at or after zero', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5000)).toBe('00:00');
  });
  it('shows minutes and seconds under an hour', () => {
    expect(formatCountdown(59_000)).toBe('00:59');
    expect(formatCountdown(22 * MIN + 8_000)).toBe('22:08');
  });
  it('shows hours under a day', () => {
    expect(formatCountdown(HOUR)).toBe('01:00:00');
    expect(formatCountdown(DAY - 1000)).toBe('23:59:59');
  });
  it('shows days beyond a day, never 292 hours', () => {
    expect(formatCountdown(DAY)).toBe('1d 00:00:00');
    expect(formatCountdown(5 * DAY + 3 * HOUR + 22 * MIN + 8_000)).toBe('5d 03:22:08');
    expect(formatCountdown(40 * DAY)).toBe('40d 00:00:00');
  });
  it('never throws on nonsense', () => {
    expect(formatCountdown(Number.NaN)).toBe('--:--');
    expect(formatCountdown(Number.POSITIVE_INFINITY)).toBe('--:--');
  });
});

describe('standbyState', () => {
  it('is unavailable when the read failed, never a false TBA', () => {
    expect(standbyState(null, T).kind).toBe('unavailable');
  });
  it('is TBA when the read worked and nothing is scheduled', () => {
    expect(standbyState([], T).kind).toBe('tba');
  });
  it('counts down to the next show, with at most two under LATER', () => {
    const s = standbyState([show('c', T + 3 * DAY), show('a', T + DAY), show('d', T + 4 * DAY), show('b', T + 2 * DAY)], T);
    expect(s.kind).toBe('countdown');
    expect(s.next?.id).toBe('a');
    expect(s.later.map((x) => x.id)).toEqual(['b', 'c']);
  });
  it('says starting soon from the start time until 9:59 after', () => {
    expect(standbyState([show('a', T)], T).kind).toBe('starting-soon');
    expect(standbyState([show('a', T)], T + 10 * MIN - 1000).kind).toBe('starting-soon');
  });
  it('says delayed from 10 minutes after the start until 29:59 after', () => {
    expect(standbyState([show('a', T)], T + 10 * MIN).kind).toBe('delayed');
    expect(standbyState([show('a', T)], T + 30 * MIN - 1000).kind).toBe('delayed');
  });
  it('keeps the late show and the later ones while delayed', () => {
    const s = standbyState([show('a', T), show('b', T + DAY)], T + 20 * MIN);
    expect(s.next?.id).toBe('a');
    expect(s.later.map((x) => x.id)).toEqual(['b']);
  });
  it('never calls an aired show delayed', () => {
    const s = standbyState([show('a', T, { aired_at: iso(T + MIN) }), show('b', T + DAY)], T + 15 * MIN);
    expect(s.kind).toBe('countdown');
    expect(s.next?.id).toBe('b');
  });
  it('moves on to the next show 30 minutes after the start', () => {
    const s = standbyState([show('a', T), show('b', T + DAY)], T + 30 * MIN);
    expect(s.kind).toBe('countdown');
    expect(s.next?.id).toBe('b');
  });
  it('shows a late show with the later ones still listed', () => {
    const s = standbyState([show('a', T), show('b', T + DAY)], T + 7 * MIN);
    expect(s.kind).toBe('starting-soon');
    expect(s.later.map((x) => x.id)).toEqual(['b']);
  });
  it('ignores a show that has already aired', () => {
    const s = standbyState([show('a', T, { aired_at: iso(T - MIN) }), show('b', T + DAY)], T + 5 * MIN);
    expect(s.next?.id).toBe('b');
  });
  it('skips rows with a broken date instead of throwing', () => {
    const s = standbyState([{ id: 'x', title: 'x', starts_at: 'not a date' }, show('b', T + DAY)], T);
    expect(s.next?.id).toBe('b');
  });
});

describe('suggestTitle', () => {
  it('suggests nothing outside the window', () => {
    expect(suggestTitle([show('a', T)], T - 7 * HOUR)).toBeNull();
    expect(suggestTitle([show('a', T)], T + 31 * MIN)).toBeNull();
  });
  it('suggests the earliest show starting within the next 6 hours or the last 30 minutes', () => {
    expect(suggestTitle([show('b', T + HOUR), show('a', T)], T - 50 * MIN)?.id).toBe('a');
    expect(suggestTitle([show('a', T)], T + 29 * MIN)?.id).toBe('a');
  });
  it('hands over to the second show of the day once the first is over 30 minutes past', () => {
    const shows = [show('first', T), show('second', T + 4 * HOUR)];
    expect(suggestTitle(shows, T + 10 * MIN)?.id).toBe('first');
    expect(suggestTitle(shows, T + 31 * MIN)?.id).toBe('second');
  });
  it('never suggests an aired show', () => {
    expect(suggestTitle([show('a', T, { aired_at: iso(T) })], T)).toBeNull();
  });
  it('returns null on empty or broken input', () => {
    expect(suggestTitle([], T)).toBeNull();
    expect(suggestTitle([{ id: 'x', title: 'x', starts_at: '' }], T)).toBeNull();
  });
});

describe('validateShow', () => {
  const now = T - 5 * DAY;
  it('rejects an empty or whitespace title', () => {
    expect(validateShow({ title: '', startsAt: T }, now, []).ok).toBe(false);
    expect(validateShow({ title: '   ', startsAt: T }, now, []).ok).toBe(false);
  });
  it('accepts 80 characters after trimming and rejects 81', () => {
    expect(validateShow({ title: `  ${'x'.repeat(80)}  `, startsAt: T }, now, []).ok).toBe(true);
    expect(validateShow({ title: 'x'.repeat(81), startsAt: T }, now, []).ok).toBe(false);
  });
  it('rejects an invalid date', () => {
    expect(validateShow({ title: 'Psy Night', startsAt: Number.NaN }, now, []).ok).toBe(false);
  });
  it('warns about a past start but still allows it', () => {
    const v = validateShow({ title: 'Psy Night', startsAt: now - HOUR }, now, []);
    expect(v.ok).toBe(true);
    expect(v.warnings.join(' ')).toMatch(/past/i);
  });
  it('warns about another show within 60 minutes, naming it and the gap', () => {
    const v = validateShow({ title: 'Part 2', startsAt: T + 30 * MIN }, now, [{ id: 'g', title: 'Goa Classics 1998', starts_at: iso(T) }]);
    expect(v.ok).toBe(true);
    expect(v.warnings.join(' ')).toContain('Goa Classics 1998 starts 30 min before this');
  });
  it('does not warn about the show being edited', () => {
    const v = validateShow({ title: 'Same', startsAt: T + 30 * MIN }, now, [{ id: 'g', title: 'Same', starts_at: iso(T) }], 'g');
    expect(v.warnings).toEqual([]);
  });
});

describe('formatShowTime', () => {
  it('formats Israel time for an Israeli phone', () => {
    expect(formatShowTime(iso(T), 'Asia/Jerusalem', 'en-GB')).toBe('Sun 29 Nov, 22:00 GMT+2');
  });
  it('formats New York time in a US phone format', () => {
    expect(formatShowTime(iso(T), 'America/New_York', 'en-US')).toBe('Sun, Nov 29, 3:00 PM EST');
  });
  it('follows daylight saving in both zones', () => {
    const june = iso(Date.UTC(2027, 5, 1, 19, 0));
    expect(formatShowTime(june, 'Asia/Jerusalem', 'en-GB')).toBe('Tue 1 Jun, 22:00 GMT+3');
    expect(formatShowTime(june, 'America/New_York', 'en-US')).toBe('Tue, Jun 1, 3:00 PM EDT');
  });
  it('falls back to UTC for an unknown zone and to --:-- for a broken date', () => {
    expect(formatShowTime(iso(T), 'Mars/Base', 'en-GB')).toContain('UTC');
    expect(formatShowTime('nope', 'Asia/Jerusalem', 'en-GB')).toBe('--:--');
  });
});

describe('hostTimePreview', () => {
  it('shows the device line as Israel and UTC, with no note, on an Israeli device', () => {
    const p = hostTimePreview(T, 'Asia/Jerusalem');
    expect(p.lines).toEqual(['Sun, 29 Nov 2026, 22:00 Israel']);
    expect(p.utc).toBe('20:00 UTC');
    expect(p.abroad).toBe(false);
  });
  it('adds the Israel line and a note on a device abroad, labelled with what Intl gives', () => {
    const p = hostTimePreview(T, 'Asia/Kolkata');
    expect(p.lines).toEqual(['Mon, 30 Nov 2026, 01:30 GMT+5:30', 'Sun, 29 Nov 2026, 22:00 Israel']);
    expect(p.abroad).toBe(true);
  });
  it('never throws on an unknown zone or a broken time', () => {
    expect(() => hostTimePreview(T, 'Mars/Base')).not.toThrow();
    expect(hostTimePreview(T, 'Mars/Base').lines[0]).not.toMatch(/UTC UTC/);
    expect(hostTimePreview(Number.NaN, 'Asia/Jerusalem').lines).toEqual([]);
  });
});

describe('formatRelative', () => {
  it('counts down in the most useful unit', () => {
    expect(formatRelative(T + 12 * MIN, T)).toBe('in 12 min');
    expect(formatRelative(T + 3 * HOUR + 20 * MIN, T)).toBe('in 3h 20m');
    expect(formatRelative(T + DAY + 5 * HOUR, T)).toBe('in 1d 5h');
    expect(formatRelative(T + 5 * DAY + 3 * HOUR, T)).toBe('in 5 days');
    expect(formatRelative(T + 12 * DAY, T)).toBe('in 12 days');
  });
  it('rounds before splitting, so it never reads 60m, and drops zero units', () => {
    expect(formatRelative(T + HOUR + 59 * MIN + 40_000, T)).toBe('in 2h');
    expect(formatRelative(T + 59 * MIN + 40_000, T)).toBe('in 1h');
    expect(formatRelative(T + DAY, T)).toBe('in 1d');
    expect(formatRelative(T + 5 * DAY, T)).toBe('in 5 days');
  });
  it('says how long ago a show started', () => {
    expect(formatRelative(T, T + 7 * MIN)).toBe('started 7 min ago');
    expect(formatRelative(T, T + 2 * HOUR)).toBe('started 2 h ago');
  });
  it('never throws on nonsense', () => {
    expect(formatRelative(Number.NaN, T)).toBe('');
  });
});

describe('wallTimeToMs / msToWallTime', () => {
  it('reads a typed local time in the given zone', () => {
    expect(wallTimeToMs('2026-11-29T22:00', 'Asia/Jerusalem')).toBe(T);
    expect(wallTimeToMs('2026-11-29T15:00', 'America/New_York')).toBe(T);
  });
  it('handles Israel summer time', () => {
    expect(wallTimeToMs('2027-06-01T22:00', 'Asia/Jerusalem')).toBe(Date.UTC(2027, 5, 1, 19, 0));
  });
  it('round-trips for the edit form', () => {
    expect(msToWallTime(T, 'Asia/Jerusalem')).toBe('2026-11-29T22:00');
    expect(msToWallTime(wallTimeToMs('2027-06-01T22:00', 'Asia/Jerusalem'), 'Asia/Jerusalem')).toBe('2027-06-01T22:00');
  });
  it('never throws: empty or broken input gives NaN or an empty string', () => {
    expect(wallTimeToMs('', 'Asia/Jerusalem')).toBeNaN();
    expect(wallTimeToMs('nope', 'Asia/Jerusalem')).toBeNaN();
    expect(Number.isFinite(wallTimeToMs('2026-11-29T22:00', 'Mars/Base'))).toBe(true);
    expect(msToWallTime(Number.NaN, 'Asia/Jerusalem')).toBe('');
  });
});

describe('showToMarkAired', () => {
  it('picks the show starting within 60 minutes ahead or 30 minutes behind', () => {
    expect(showToMarkAired([show('a', T)], T - 50 * MIN)?.id).toBe('a');
    expect(showToMarkAired([show('a', T)], T + 20 * MIN)?.id).toBe('a');
  });
  it('marks nothing for a broadcast outside that window', () => {
    expect(showToMarkAired([show('a', T)], T - 61 * MIN)).toBeNull();
    expect(showToMarkAired([show('a', T)], T + 31 * MIN)).toBeNull();
  });
  it('never picks a show that already aired, and picks the nearest start', () => {
    expect(showToMarkAired([show('a', T, { aired_at: iso(T) })], T)).toBeNull();
    expect(showToMarkAired([show('far', T + 50 * MIN), show('near', T + 5 * MIN)], T)?.id).toBe('near');
  });
  it('returns null on empty or broken input', () => {
    expect(showToMarkAired([], T)).toBeNull();
    expect(showToMarkAired([{ id: 'x', title: 'x', starts_at: 'nope' }], T)).toBeNull();
  });
});
