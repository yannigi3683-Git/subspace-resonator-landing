import { useEffect, useRef, useState, useCallback } from 'react';
import { attachHls, type HlsHandle } from '../hls/listenerStream';

export interface HlsListener {
  /** True once a healthy buffer is built and it is safe to crossfade audio onto HLS. */
  ready: boolean;
  playing: boolean;
  bufferedAhead: number;
  /** Start playback. MUST be called inside a user gesture (iOS). Starts muted. */
  play: () => Promise<void>;
  setVolume: (v: number) => void;
  destroy: () => void;
}

// Crossfade onto HLS only once this many seconds are buffered ahead, so the switch never lands on
// an empty buffer.
const HEALTHY_BUFFER_S = 6;

// Manages a hidden <video> playing the deep-buffer HLS stream. Created muted so it can be started
// inside the same tap that starts WebRTC (iOS needs a gesture per element); the transport unmutes
// it during the crossfade. <video> not <audio>: audio-only HLS on <audio> hits the iOS bug.
export function useHlsListener(streamUrl: string | undefined): HlsListener {
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [bufferedAhead, setBufferedAhead] = useState(0);
  const elRef = useRef<HTMLVideoElement | null>(null);
  const handleRef = useRef<HlsHandle | null>(null);

  useEffect(() => {
    if (!streamUrl || typeof document === 'undefined') return;
    const el = document.createElement('video');
    el.setAttribute('playsinline', '');
    el.muted = true;
    el.volume = 0;
    elRef.current = el;

    let cancelled = false;
    attachHls(el, streamUrl)
      .then((h) => { if (cancelled) h.destroy(); else handleRef.current = h; })
      .catch(() => {});

    const onPlaying = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('pause', onPause);

    const iv = setInterval(() => {
      let ahead = 0;
      for (let i = 0; i < el.buffered.length; i++) {
        if (el.currentTime >= el.buffered.start(i) && el.currentTime <= el.buffered.end(i) + 0.5) {
          ahead = el.buffered.end(i) - el.currentTime;
        }
      }
      setBufferedAhead(ahead);
      if (ahead >= HEALTHY_BUFFER_S) setReady(true);
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(iv);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('pause', onPause);
      handleRef.current?.destroy();
      handleRef.current = null;
      el.pause();
      elRef.current = null;
      setReady(false);
      setPlaying(false);
      setBufferedAhead(0);
    };
  }, [streamUrl]);

  const play = useCallback(async () => {
    try { await elRef.current?.play(); } catch { /* gesture/autoplay refusal — non-fatal */ }
  }, []);

  const setVolume = useCallback((v: number) => {
    const el = elRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(1, v));
    el.muted = clamped === 0;
    el.volume = clamped;
  }, []);

  const destroy = useCallback(() => {
    handleRef.current?.destroy();
    handleRef.current = null;
  }, []);

  return { ready, playing, bufferedAhead, play, setVolume, destroy };
}
