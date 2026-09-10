import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useConnectingAfterTap, TAP_TIMEOUT_MS } from './useConnectingAfterTap';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(playing = false) {
  return renderHook(({ p }) => useConnectingAfterTap(p), { initialProps: { p: playing } });
}

describe('useConnectingAfterTap', () => {
  it('is idle before anyone taps', () => {
    const { result } = setup();
    expect(result.current[0]).toBe(false);
  });

  it('shows connecting the instant the listener taps', () => {
    // The whole point: the tap starts a real reconnection, and without this the button keeps
    // saying TAP TO LISTEN, which reads as "nothing happened".
    const { result } = setup();
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
  });

  it('clears as soon as audio actually returns', () => {
    const { result, rerender } = setup(false);
    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);

    rerender({ p: true });
    expect(result.current[0]).toBe(false);
  });

  it('gives the button back if the tap never produces sound', () => {
    // A tap can fail silently (autoplay refusal, a connection that never comes up). Leaving the
    // button disabled forever would strand the listener with no move at all.
    const { result } = setup(false);
    act(() => result.current[1]());
    act(() => { vi.advanceTimersByTime(TAP_TIMEOUT_MS + 500); });
    expect(result.current[0]).toBe(false);
  });

  it('can be tapped again after the timeout', () => {
    const { result } = setup(false);
    act(() => result.current[1]());
    act(() => { vi.advanceTimersByTime(TAP_TIMEOUT_MS + 500); });

    act(() => result.current[1]());
    expect(result.current[0]).toBe(true);
  });
});
