import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useListenerTransport } from './useListenerTransport';
import { useListenerAudio } from './useListenerAudio';
import { useHlsListener } from './useHlsListener';
import type { Station } from '../types';

vi.mock('./useListenerAudio', () => ({ useListenerAudio: vi.fn() }));
vi.mock('./useHlsListener', () => ({ useHlsListener: vi.fn() }));

const STREAM = 'https://r2.example/abc/stream.m3u8';

function station(): Station {
  return {
    mode: 'live',
    live_title: 'Live',
    live_session: { startedAt: '2026-09-10T10:29:22.615Z', cfSessionId: 'abc', streamUrl: STREAM },
    slow_mode_s: 0,
    locked: false,
  } as unknown as Station;
}

const webrtcEl = { pause: vi.fn(), play: vi.fn() } as unknown as HTMLAudioElement;

function mockWebrtc(over: Partial<Record<string, unknown>> = {}) {
  return {
    playing: true,
    ready: true,
    connectionError: false,
    playbackBlocked: false,
    resume: vi.fn(),
    retry: vi.fn(),
    volume: 1,
    setVolume: vi.fn(),
    audioElement: webrtcEl,
    getStats: vi.fn(),
    stalls: 0,
    ...over,
  };
}

function mockHls(over: Partial<Record<string, unknown>> = {}) {
  return {
    ready: true,
    playing: true,
    bufferedAhead: 30,
    stalledMs: 0,
    play: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn(),
    claimMediaSession: vi.fn(),
    destroy: vi.fn(),
    ...over,
  };
}

const supabase = {} as SupabaseClient;

beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

// The crossfade runs on a setInterval; run it out so the hook really reaches the 'hls' phase.
async function settleCrossfade(view: { rerender: () => void }) {
  await act(async () => { view.rerender(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  await act(async () => { view.rerender(); });
}

// Drive the hook from "healthy on HLS" into "listener's own network died", which is what a phone
// going into airplane mode mid-show looks like: HLS stops, WebRTC was already paused by the HLS
// phase, and cfSessionId/streamUrl never change because the HOST is perfectly fine.
function harness() {
  let webrtc = mockWebrtc();
  let hls = mockHls();
  vi.mocked(useListenerAudio).mockImplementation(() => webrtc as never);
  vi.mocked(useHlsListener).mockImplementation(() => hls as never);
  const view = renderHook(() => useListenerTransport(supabase, station()));
  return {
    view,
    get webrtc() { return webrtc; },
    get hls() { return hls; },
    setHls(over: Partial<Record<string, unknown>>) { hls = mockHls({ ...hls, ...over }); },
    setWebrtc(over: Partial<Record<string, unknown>>) { webrtc = mockWebrtc({ ...webrtc, ...over }); },
  };
}

describe('useListenerTransport resume after a listener-side outage', () => {
  it('a tap while HLS is dead steps back to WebRTC instead of doing nothing', async () => {
    // Before the fix, phase stayed 'hls' forever: `playing` is read from hlsPlaying, so the overlay
    // never cleared, and the phase==='hls' effect kept calling webrtcEl.pause(), undoing the very
    // reconnect the tap had just performed. Only a page refresh recovered. Observed live 2026-09-10.
    const h = harness();

    // Let the crossfade complete so the hook is genuinely in the 'hls' phase.
    await settleCrossfade(h.view);
    expect(h.view.result.current.transportInfo.phase).toBe('hls');

    // The listener's own connection dies: HLS stops. The host is untouched.
    h.setHls({ playing: false, ready: false });
    await act(async () => { h.view.rerender(); });

    act(() => { h.view.result.current.resume(); });
    await act(async () => { h.view.rerender(); });

    // The tap must hand playback back to live WebRTC rather than leaving a dead HLS in charge.
    expect(h.view.result.current.transportInfo.phase).toBe('webrtc');
    expect(h.webrtc.resume).toHaveBeenCalled();
  });

  it('restores WebRTC volume on that tap, since the crossfade had faded it to zero', async () => {
    // The crossfade ends with setWebrtcVolume(0). Stepping back to 'webrtc' without restoring the
    // user's volume would hand over to a transport that is muted, which reads as "tap did nothing".
    const h = harness();
    await settleCrossfade(h.view);
    h.setHls({ playing: false, ready: false });
    await act(async () => { h.view.rerender(); });

    h.webrtc.setVolume.mockClear();
    act(() => { h.view.result.current.resume(); });

    expect(h.webrtc.setVolume).toHaveBeenCalledWith(1);
  });

  it('leaves a healthy HLS alone', async () => {
    // A tap while HLS is genuinely playing must not knock the listener off the deep buffer.
    const h = harness();
    await settleCrossfade(h.view);
    const before = h.view.result.current.transportInfo.phase;

    act(() => { h.view.result.current.resume(); });
    await act(async () => { h.view.rerender(); });

    expect(h.view.result.current.transportInfo.phase).toBe(before);
  });
});
