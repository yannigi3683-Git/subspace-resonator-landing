import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Station } from '../types';
import { useListenerAudio, type UseListenerAudioResult } from './useListenerAudio';
import { useHlsListener } from './useHlsListener';

// Volume for each transport at step `i` of an `steps`-long equal-power-ish linear crossfade.
// Pure so the ramp is unit-testable. t goes 0 -> 1: WebRTC fades out, HLS fades in.
export function crossfadeVolumes(i: number, steps: number, userVolume: number): { webrtc: number; hls: number } {
  const t = Math.max(0, Math.min(1, i / steps));
  return { webrtc: userVolume * (1 - t), hls: userVolume * t };
}

const CROSSFADE_MS = 1500;
const CROSSFADE_STEPS = 15;

// Listener transport. When the station advertises an HLS `streamUrl`, the listener joins on WebRTC
// for INSTANT sound (no silent wait), loads HLS in the background, and once HLS has a healthy
// buffer crossfades audio onto it (deep buffer: no cuts, no warp, survives phone screen-lock).
// WebRTC is kept muted afterwards as a dormant fallback. With NO streamUrl this returns the
// WebRTC hook verbatim, so today's behavior is byte-for-byte unchanged.
export function useListenerTransport(supabase: SupabaseClient, station: Station): UseListenerAudioResult {
  const webrtc = useListenerAudio(supabase, station);
  const streamUrl = station.live_session?.streamUrl;
  const cfSessionId = station.live_session?.cfSessionId;
  const hls = useHlsListener(streamUrl);

  const [switched, setSwitched] = useState(false);
  const [userVolume, setUserVolume] = useState(1);
  const crossfadingRef = useRef(false);

  // Reset the switch per broadcast / stream change.
  useEffect(() => {
    setSwitched(false);
    crossfadingRef.current = false;
  }, [streamUrl, cfSessionId]);

  const { setVolume: setWebrtcVolume } = webrtc;
  const { ready: hlsReady, playing: hlsPlaying, setVolume: setHlsVolume, play: hlsPlay } = hls;

  // Crossfade once HLS is healthy and WebRTC is already audible.
  useEffect(() => {
    if (!streamUrl || switched || crossfadingRef.current) return;
    if (!(hlsReady && hlsPlaying && webrtc.playing)) return;
    crossfadingRef.current = true;
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
        setSwitched(true);
        crossfadingRef.current = false;
      }
    }, CROSSFADE_MS / CROSSFADE_STEPS);
    return () => clearInterval(id);
  }, [streamUrl, switched, hlsReady, hlsPlaying, webrtc.playing, userVolume, setWebrtcVolume, setHlsVolume]);

  // Start HLS (muted) inside the same user gesture that starts WebRTC, so iOS allows it later.
  const resume = useCallback(() => {
    webrtc.resume();
    void hlsPlay();
  }, [webrtc, hlsPlay]);

  const setVolume = useCallback((v: number) => {
    setUserVolume(v);
    if (switched) setHlsVolume(v);
    else setWebrtcVolume(v);
  }, [switched, setHlsVolume, setWebrtcVolume]);

  if (!streamUrl) return webrtc;

  return { ...webrtc, resume, volume: userVolume, setVolume };
}
