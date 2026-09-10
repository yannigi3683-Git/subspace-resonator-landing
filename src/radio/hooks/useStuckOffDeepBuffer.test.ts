import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStuckOffDeepBuffer, STUCK_OFF_HLS_MS } from './useStuckOffDeepBuffer';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const past = () => act(() => { vi.advanceTimersByTime(STUCK_OFF_HLS_MS + 2000); });

function setup(onDeepBuffer: boolean, offered = true) {
  return renderHook(
    ({ on, off }) => useStuckOffDeepBuffer(on, off),
    { initialProps: { on: onDeepBuffer, off: offered } },
  );
}

describe('useStuckOffDeepBuffer', () => {
  it('stays quiet for someone who never had the deep buffer', () => {
    // A listener still warming up on WebRTC has not lost anything, and telling them to reload
    // during a normal join would be wrong.
    const { result } = setup(false);
    past();
    expect(result.current).toBe(false);
  });

  it('fires once the deep buffer was had, lost, and has not come back', () => {
    // The case Yanni hit: HLS-BUF healthy at 9.9s but still pinned to WEBRTC, and WebRTC does not
    // survive a screen lock, so this listener loses audio the moment the phone sleeps.
    const { result, rerender } = setup(true);
    rerender({ on: false, off: true });
    expect(result.current).toBe(false);
    past();
    expect(result.current).toBe(true);
  });

  it('stays quiet when the deep buffer returns inside the window', () => {
    // With the crossfade re-arm this is the normal path, so the prompt should almost never appear.
    const { result, rerender } = setup(true);
    rerender({ on: false, off: true });
    act(() => { vi.advanceTimersByTime(10_000); });
    rerender({ on: true, off: true });
    past();
    expect(result.current).toBe(false);
  });

  it('clears when the deep buffer comes back after the prompt showed', () => {
    const { result, rerender } = setup(true);
    rerender({ on: false, off: true });
    past();
    expect(result.current).toBe(true);
    rerender({ on: true, off: true });
    expect(result.current).toBe(false);
  });

  it('says nothing while the listener is still offline', () => {
    // Reloading with no connection hands them a blank page. Wait until the network is back.
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { result, rerender } = setup(true);
    rerender({ on: false, off: true });
    past();
    expect(result.current).toBe(false);
  });

  it('stays quiet when no deep buffer is on offer at all', () => {
    // Broadcast with the restreamer off: there is no streamUrl, WebRTC is the only transport, and
    // nothing is wrong.
    const { result, rerender } = setup(true, true);
    rerender({ on: false, off: false });
    past();
    expect(result.current).toBe(false);
  });
});
