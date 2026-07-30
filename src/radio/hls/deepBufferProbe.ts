// Host-side liveness probe for the deep-buffer (HLS) stream.
//
// The console must NOT play the stream (feedback + bandwidth), so "is the restreamer alive" is
// answered by watching the tiny .m3u8 index instead: the restreamer rewrites it every ~4s with
// Cache-Control max-age=1 (restreamer/src/sink/r2.mjs), so a body that has not changed for
// STALL_MS means the producer stopped. Comparing the whole body beats parsing
// #EXT-X-MEDIA-SEQUENCE here: with 4s segments an identical body for 15s can only mean stalled,
// and there is no parser to go wrong on a truncated playlist.
//
// This matters because a restreamer PC that loses power never gets to clear live_session.streamUrl,
// so the DB keeps advertising a dead stream. A light driven by the URL alone would show green over
// silence, which is worse than no light.

export type DeepBufferState = 'off' | 'starting' | 'on' | 'stalled';

export const STALL_MS = 15000;

export interface ProbeMemo {
  /** Last playlist body successfully fetched, or null before the first success. */
  body: string | null;
  /** When the body last changed (or when probing started). 0 = not started. */
  changedAt: number;
  /** True once we have seen the playlist actually move, i.e. proof of a live producer. */
  seenChange: boolean;
}

export function emptyMemo(): ProbeMemo {
  return { body: null, changedAt: 0, seenChange: false };
}

// Fold one probe result into the state. `body === null` means the fetch failed, which is treated as
// "no change" rather than an error so a single blip cannot flip the light.
export function nextProbeState(
  memo: ProbeMemo,
  body: string | null,
  now: number,
): { memo: ProbeMemo; state: DeepBufferState } {
  if (body !== null && memo.body === null) {
    // A playlist exists, but nothing yet proves it is still being written to.
    return { memo: { body, changedAt: now, seenChange: false }, state: 'starting' };
  }

  if (body !== null && body !== memo.body) {
    return { memo: { body, changedAt: now, seenChange: true }, state: 'on' };
  }

  const changedAt = memo.changedAt || now;
  if (now - changedAt >= STALL_MS) {
    return { memo: { ...memo, changedAt }, state: 'stalled' };
  }
  return { memo: { ...memo, changedAt }, state: memo.seenChange ? 'on' : 'starting' };
}
