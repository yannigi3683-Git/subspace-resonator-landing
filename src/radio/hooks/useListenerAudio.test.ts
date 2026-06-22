import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useListenerAudio } from './useListenerAudio';

// Intercept the dynamic import so the hook doesn't need real WebRTC.
// vi.mock is hoisted, so it catches both static and dynamic imports of this path.
vi.mock('../rtc/subscriber', () => ({
  Subscriber: vi.fn().mockImplementation((callbacks: { onStreamReady: (s: MediaStream) => void }) => ({
    connect: vi.fn().mockImplementation(() => {
      callbacks.onStreamReady({} as MediaStream);
      return Promise.resolve();
    }),
    disconnect: vi.fn(),
    setBufferMs: vi.fn(),
    getStats: vi.fn().mockResolvedValue(null),
  })),
}));

function fakeSupabase() {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    }),
    removeChannel: vi.fn(),
  } as unknown as Parameters<typeof useListenerAudio>[0];
}

const liveStation = {
  mode: 'live' as const,
  live_session: { cfSessionId: 'sess-1' },
  live_title: 'Test',
  slow_mode_s: 0,
  locked: false,
} as unknown as Parameters<typeof useListenerAudio>[1];

beforeEach(() => {
  // jsdom's Audio().play() is not implemented — silence the unhandled rejection
  HTMLAudioElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useListenerAudio stall counting', () => {
  it('onwaiting increments stalls after playback starts', async () => {
    const { result } = renderHook(() => useListenerAudio(fakeSupabase(), liveStation));
    await act(async () => {});

    const audio = result.current.audioElement;
    expect(audio).not.toBeNull();

    // Simulate playback starting
    act(() => { audio!.dispatchEvent(new Event('playing')); });
    expect(result.current.stalls).toBe(0);

    // waiting = real buffer underrun → should count
    act(() => { audio!.dispatchEvent(new Event('waiting')); });
    expect(result.current.stalls).toBe(1);
  });

  it('onstalled does not increment stalls (spurious MediaStream event)', async () => {
    const { result } = renderHook(() => useListenerAudio(fakeSupabase(), liveStation));
    await act(async () => {});

    const audio = result.current.audioElement;
    expect(audio).not.toBeNull();

    act(() => { audio!.dispatchEvent(new Event('playing')); });

    // stalled fires spuriously on MediaStream sources → must NOT count
    act(() => { audio!.dispatchEvent(new Event('stalled')); });
    expect(result.current.stalls).toBe(0);
  });

  it('one real dropout counts as 1, not 2 (no double-count)', async () => {
    const { result } = renderHook(() => useListenerAudio(fakeSupabase(), liveStation));
    await act(async () => {});

    const audio = result.current.audioElement;
    act(() => { audio!.dispatchEvent(new Event('playing')); });

    // Both events fire for a single underrun — should only count once
    act(() => {
      audio!.dispatchEvent(new Event('waiting'));
      audio!.dispatchEvent(new Event('stalled'));
    });
    expect(result.current.stalls).toBe(1);
  });
});
