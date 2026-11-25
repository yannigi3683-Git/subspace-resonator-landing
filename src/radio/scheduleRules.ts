// Pure rules for the radio schedule. Every function is total: bad dates, empty lists and unknown
// time zones return a safe value instead of throwing, because suggestTitle and the title hint run
// beside GoLivePanel, outside the Schedule tab's error boundary, where a throw would unmount the
// live broadcast panel.

export interface Show {
  id: string;
  title: string;
  starts_at: string;
  aired_at?: string | null;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
export const GRACE_MS = 30 * MIN;
export const SUGGEST_AHEAD_MS = 6 * HOUR;
export const CLASH_MS = HOUR;
export const TITLE_MAX = 80;
export const ISRAEL = 'Asia/Jerusalem';

const startMs = (s: Show): number => Date.parse(s.starts_at);
const usable = (s: Show): boolean => Number.isFinite(startMs(s)) && !s.aired_at;
const bySoonest = (a: Show, b: Show): number => startMs(a) - startMs(b);
const p2 = (n: number): string => String(n).padStart(2, '0');

export function formatCountdown(ms: number): string {
  if (!Number.isFinite(ms)) return '--:--';
  if (ms <= 0) return '00:00';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d) return `${d}d ${p2(h)}:${p2(m)}:${p2(s)}`;
  if (h) return `${p2(h)}:${p2(m)}:${p2(s)}`;
  return `${p2(m)}:${p2(s)}`;
}

export type StandbyState =
  | { kind: 'countdown' | 'starting-soon'; next: Show; later: Show[] }
  | { kind: 'tba' | 'unavailable'; next: null; later: Show[] };

// `shows === null` means the read failed: say nothing rather than a false "TBA".
export function standbyState(shows: Show[] | null, nowMs: number): StandbyState {
  if (!shows) return { kind: 'unavailable', next: null, later: [] };
  const upcoming = shows.filter((s) => usable(s) && startMs(s) > nowMs - GRACE_MS).sort(bySoonest);
  if (!upcoming.length) return { kind: 'tba', next: null, later: [] };
  const [next, ...rest] = upcoming;
  return { kind: startMs(next) <= nowMs ? 'starting-soon' : 'countdown', next, later: rest.slice(0, 2) };
}

export function suggestTitle(shows: Show[], nowMs: number): Show | null {
  const inWindow = shows
    .filter((s) => usable(s) && startMs(s) >= nowMs - GRACE_MS && startMs(s) <= nowMs + SUGGEST_AHEAD_MS)
    .sort(bySoonest);
  return inWindow[0] ?? null;
}

export interface ShowCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateShow(
  input: { title: string; startsAt: number },
  nowMs: number,
  others: Show[],
  ignoreId?: string,
): ShowCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const title = (input.title ?? '').trim();
  if (!title) errors.push('Give the show a title.');
  if (title.length > TITLE_MAX) errors.push(`Title is over ${TITLE_MAX} characters.`);
  if (!Number.isFinite(input.startsAt)) {
    errors.push('Pick a start date and time.');
    return { ok: false, errors, warnings };
  }
  if (input.startsAt < nowMs) warnings.push('This time is in the past. Guests will not see it.');
  const near = others
    .filter((s) => s.id !== ignoreId && Number.isFinite(startMs(s)) && Math.abs(startMs(s) - input.startsAt) < CLASH_MS)
    .sort((a, b) => Math.abs(startMs(a) - input.startsAt) - Math.abs(startMs(b) - input.startsAt))[0];
  if (near) {
    const gap = Math.round(Math.abs(startMs(near) - input.startsAt) / MIN);
    const when = gap === 0 ? 'at the same time' : `${gap} min ${startMs(near) < input.startsAt ? 'before' : 'after'} this`;
    warnings.push(`${near.title} starts ${when}. You can still save it.`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

function safeFormat(ms: number, zone: string, locale: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: zone, ...opts }).format(new Date(ms));
  } catch {
    return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...opts, timeZoneName: 'short' }).format(new Date(ms));
  }
}

export function formatShowTime(isoString: string, zone: string, locale: string): string {
  const ms = Date.parse(isoString);
  if (!Number.isFinite(ms)) return '--:--';
  return safeFormat(ms, zone, locale, {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  });
}

function zoneLabel(zone: string, ms: number): string {
  if (zone === ISRAEL) return 'Israel';
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName')?.value ?? zone;
  } catch {
    return '';
  }
}

const HOST_OPTS: Intl.DateTimeFormatOptions = {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
};

export interface HostPreview {
  lines: string[];
  utc: string;
  abroad: boolean;
}

// The host types a local time; this shows it back in the device's own zone, in Israel when the
// device is elsewhere, and in UTC, so a phone on the wrong zone is caught before the show is saved.
export function hostTimePreview(ms: number, deviceZone: string): HostPreview {
  if (!Number.isFinite(ms)) return { lines: [], utc: '', abroad: false };
  const abroad = deviceZone !== ISRAEL;
  const lines = [`${safeFormat(ms, deviceZone, 'en-GB', HOST_OPTS)} ${zoneLabel(deviceZone, ms)}`.trim()];
  if (abroad) lines.push(`${safeFormat(ms, ISRAEL, 'en-GB', HOST_OPTS)} Israel`);
  const utc = `${safeFormat(ms, 'UTC', 'en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} UTC`;
  return { lines, utc, abroad };
}
