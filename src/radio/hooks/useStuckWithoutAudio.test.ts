import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStuckWithoutAudio, STUCK_MS } from './useStuckWithoutAudio';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const past = () => act(() => { vi.advanceTimersByTime(STUCK_MS + 1000); });

describe('useStuckWithoutAudio', () => {
  it('never marks a first-time visitor as stuck', () => {
    // On arrival nothing has played, because they have not tapped yet. Telling someone to reload a
    // page they just opened would be nonsense, and TAP TO LISTEN is exactly the right prompt.
    const { result } = renderHook(() => useStuckWithoutAudio(false));
    past();
    expect(result.current).toBe(false);
  });

  it('marks a listener stuck once audio played, stopped, and stayed stopped', () => {
    // The listener's own connection died (airplane mode, wifi gone). A tap cannot fix this, so the
    // page should stop offering one.
    const { result, rerender } = renderHook(({ p }) => useStuckWithoutAudio(p), {
      initialProps: { p: true },
    });
    rerender({ p: false });
    expect(result.current).toBe(false); // not immediately — a host reconnect recovers in seconds
    past();
    expect(result.current).toBe(true);
  });

  it('stays quiet when audio comes back before the delay', () => {
    // This is the HOST-drop case: cfSessionId changes, the audio effect re-runs, and the listener
    // recovers on their own well inside the window. They must never be told to reload.
    const { result, rerender } = renderHook(({ p }) => useStuckWithoutAudio(p), {
      initialProps: { p: true },
    });
    rerender({ p: false });
    act(() => { vi.advanceTimersByTime(4000); });
    rerender({ p: true });
    past();
    expect(result.current).toBe(false);
  });

  it('clears once audio returns', () => {
    const { result, rerender } = renderHook(({ p }) => useStuckWithoutAudio(p), {
      initialProps: { p: true },
    });
    rerender({ p: false });
    past();
    expect(result.current).toBe(true);

    rerender({ p: true });
    expect(result.current).toBe(false);
  });
});
