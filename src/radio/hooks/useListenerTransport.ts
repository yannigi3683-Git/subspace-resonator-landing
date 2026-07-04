import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Station } from '../types';
import { useListenerAudio, type UseListenerAudioResult } from './useListenerAudio';
import { useHlsListener } from './useHlsListener';

export type TransportPhase = 'webrtc' | 'crossfading' | 'hls';

export interface TransportInfo {
  /** Which transport is carrying audio right now. */
  phase: TransportPhase;
  /** True when the station is advertising an HLS stream at all. */
  hlsAvailable: boolean;
  hlsReady: boolean;
  hlsBufferedAhead: number;
}

export interface ListenerTransportResult extends UseListenerAudioResult {
  transportInfo: TransportInfo;
}

// Volume for each transport at step `i` of an `steps`-long linear crossfade. Pure -> unit-testable.
export function crossfadeVolumes(i: number, steps: number, userVolume: number): { webrtc: number; hls: number } {
  const t = Math.max(0, Math.min(1, i / steps));
  return { webrtc: userVolume * (1 - t), hls: userVolume * t };
}

const CROSSFADE_MS = 1500;
const CROSSFADE_STEPS = 15;

// Listener transport. When the station advertises an HLS `streamUrl`, the listener joins on WebRTC
// for INSTANT sound (no silent wait), loads HLS in the background, and once HLS has a healthy
// buffer crossfades audio onto it (deep buffer: no cuts, no warp, survives phone screen-lock).
// WebRTC is kept muted afterwards as a dormant fallback. With NO streamUrl this behaves exactly
// like the WebRTC hook, so today's behavior is unchanged (ships inert until a streamUrl exists).
export function useListenerTransport(supabase: SupabaseClient, station: Station): ListenerTransportResult {
  const webrtc = useListenerAudio(supabase, station);
  const streamUrl = station.live_session?.streamUrl;
  const cfSessionId = station.live_session?.cfSessionId;
  const hls = useHlsListener(streamUrl);

  const [phase, setPhase] = useState<TransportPhase>('webrtc');
  const [userVolume, setUserVolume] = useState(1);

  // Reset per broadcast / stream change.
  useEffect(() => { setPhase('webrtc'); }, [streamUrl, cfSessionId]);

  const { setVolume: setWebrtcVolume } = webrtc;
  const { ready: hlsReady, playing: hlsPlaying, setVolume: setHlsVolume, play: hlsPlay } = hls;

  // Crossfade once HLS is healthy and WebRTC is already audible.
  useEffect(() => {
    if (!streamUrl || phase !== 'webrtc') return;
    if (!(hlsReady && hlsPlaying && webrtc.playing)) return;
    setPhase('crossfading');
    let i = 0;
    const id = setInterval(() => {
      i++;
      const v = crossfadeVolumes(i, CROSSFADE_STEPS, userVolume);
      setWebrtcVolume(v.webrtc);
      setHlsVolume(v.hls);
      if (i >= CROSSFADE_STEPS) {
        clearInterval(id);
        setWebrtcVolume(0);
        setHlsVolume(userVolume);
        setPhase('hls');
      }
    }, CROSSFADE_MS / CROSSFADE_STEPS);
    return () => clearInterval(id);
  }, [streamUrl, phase, hlsReady, hlsPlaying, webrtc.playing, userVolume, setWebrtcVolume, setHlsVolume]);

  // Start HLS (muted) inside the same user gesture that starts WebRTC, so iOS allows it later.
  const resume = useCallback(() => {
    webrtc.resume();
    void hlsPlay();
  }, [webrtc, hlsPlay]);

  const setVolume = useCallback((v: number) => {
    setUserVolume(v);
    if (phase === 'hls') setHlsVolume(v);
    else setWebrtcVolume(v);
  }, [phase, setHlsVolume, setWebrtcVolume]);

  const transportInfo: TransportInfo = {
    phase: streamUrl ? phase : 'webrtc',
    hlsAvailable: !!streamUrl,
    hlsReady,
    hlsBufferedAhead: hls.bufferedAhead,
  };

  if (!streamUrl) return { ...webrtc, transportInfo };

  return { ...webrtc, resume, volume: userVolume, setVolume, transportInfo };
}
