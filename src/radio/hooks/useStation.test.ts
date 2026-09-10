import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useStation } from './useStation';

function makeSupabase(rows: unknown[]) {
  let i = 0;
  const single = vi.fn(async () => ({ data: rows[Math.min(i++, rows.length - 1)], error: null }));
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  const supabase = {
    from: vi.fn(() => ({ select: vi.fn(() => ({ single })) })),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  } as unknown as SupabaseClient;
  return { supabase, single };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useStation', () => {
  it('re-reads the row on a timer so a dead Realtime feed cannot freeze it', async () => {
    // The station row is read once at mount and then updated ONLY by postgres_changes. If that
    // subscription is dropped, every consumer is stuck on the mount snapshot for the rest of the
    // session. Seen live 2026-08-21: the host reconnected at 11:52 and wrote a new streamUrl, the
    // console never saw the UPDATE, and the DEEP BUFFER badge probed the old, frozen playlist and
    // read STALLED for the rest of the show while listeners were perfectly fine.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { supabase, single } = makeSupabase([
      { mode: 'live', live_session: { streamUrl: 'old.m3u8' } },
      { mode: 'live', live_session: { streamUrl: 'new.m3u8' } },
    ]);

    const { result } = renderHook(() => useStation(supabase));
    await waitFor(() => expect(result.current?.live_session?.streamUrl).toBe('old.m3u8'));

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(single).toHaveBeenCalledTimes(2);
    expect(result.current?.live_session?.streamUrl).toBe('new.m3u8');
  });

  it('re-reads when the tab becomes visible again', async () => {
    // Background tabs get their timers clamped, so returning to the tab is the moment the host is
    // most likely to be looking at a stale number.
    const { supabase, single } = makeSupabase([
      { mode: 'off', live_session: null },
      { mode: 'live', live_session: { streamUrl: 'new.m3u8' } },
    ]);

    const { result } = renderHook(() => useStation(supabase));
    await waitFor(() => expect(result.current?.mode).toBe('off'));

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current?.mode).toBe('live'));
    expect(single).toHaveBeenCalledTimes(2);
  });

  it('does not poll while the tab is hidden', async () => {
    // One row read per client per minute is nothing; the same read from every backgrounded phone
    // in a 150-listener room is load nobody is watching.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { supabase, single } = makeSupabase([{ mode: 'off', live_session: null }]);

    renderHook(() => useStation(supabase));
    await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });

    expect(single).toHaveBeenCalledTimes(1); // the mount read only
  });
});
