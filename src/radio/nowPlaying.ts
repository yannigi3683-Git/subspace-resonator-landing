// Now-playing card: what the host pushes to listeners and how the guest decides visibility.

export type NowPlayingMode = 'off' | 'always' | 'peek';

export interface NowPlayingPayload {
  /** Current track name (display only). */
  name: string;
  /** Downscaled cover-art thumbnail as a data URL, or null when the track has no art. */
  art?: string | null;
  /** How the listener should reveal the card. */
  mode: NowPlayingMode;
}

export const PEEK_SHOW_MS = 15_000;
export const PEEK_CYCLE_MS = 60_000;

/**
 * Peek visibility: show for 15s right after a track change, and for the first 15s of every
 * 60s cycle. `sinceTrackChangeMs` < 0 means no track change has happened yet.
 */
export function peekVisibleAt(elapsedMs: number, sinceTrackChangeMs: number): boolean {
  if (sinceTrackChangeMs >= 0 && sinceTrackChangeMs < PEEK_SHOW_MS) return true;
  return elapsedMs % PEEK_CYCLE_MS < PEEK_SHOW_MS;
}

/** Whether the now-playing card should currently be visible for the given mode + timing. */
export function nowPlayingVisible(
  mode: NowPlayingMode,
  elapsedMs: number,
  sinceTrackChangeMs: number,
): boolean {
  if (mode === 'off') return false;
  if (mode === 'always') return true;
  return peekVisibleAt(elapsedMs, sinceTrackChangeMs);
}

/** Listener-side visibility: nothing to show without a track name, otherwise honor the host mode. */
export function resolveVisible(
  name: string,
  mode: NowPlayingMode,
  elapsedMs: number,
  sinceTrackChangeMs: number,
): boolean {
  return name ? nowPlayingVisible(mode, elapsedMs, sinceTrackChangeMs) : false;
}
