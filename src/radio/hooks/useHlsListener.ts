import { useEffect, useRef, useState, useCallback } from 'react';
import { attachHls, type HlsHandle } from '../hls/listenerStream';

export interface HlsListener {
  /** True once a healthy buffer is built and it is safe to crossfade audio onto HLS. */
  ready: boolean;
  playing: boolean;
  bufferedAhead: number;
  /** ms the playhead has been stuck while it should be advancing (0 = healthy). Drives fallback. */
  stalledMs: number;
  /** Start playback. Called inside the user gesture (iOS); also auto-starts muted. */
  play: () => Promise<void>;
  setVolume: (v: number) => void;
  /** Claim OS media-session so audio keeps playing when the phone locks / backgrounds. */
  claimMediaSession: () => void;
  destroy: () => void;
}

// Crossfade onto HLS only once this many seconds are buffered ahead.
const HEALTHY_BUFFER_S = 6;

// Manages a hidden <video> playing the deep-buffer HLS stream. Autostarts MUTED (broadly allowed
// without a gesture), so it is genuinely *playing* (not just buffering) and ready to be unmuted by
// the crossfade. <video> not <audio>: audio-only HLS on <audio> hits the iOS bug.
export function useHlsListener(streamUrl: string | undefined): HlsListener {
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [bufferedAhead, setBufferedAhead] = useState(0);
  const [stalledMs, setStalledMs] = useState(0);
  const elRef = useRef<HTMLVideoElement | null>(null);
  const handleRef = useRef<HlsHandle | null>(null);

  useEffect(() => {
    if (!streamUrl || typeof document === 'undefined') return;
    const el = document.createElement('video');
    el.setAttribute('playsinline', '');
    el.autoplay = true;
    el.muted = true;
    el.volume = 0;
    // Attach to the DOM (offscreen). A DETACHED muted video does not reliably muted-autoplay when
    // created late (guest already in the room when streamUrl is published); an in-DOM muted+playsinline
    // video autoplays per spec. This is what fixes the "join-before-streamUrl never upgrades" bug.
    el.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-9999px;';
    document.body.appendChild(el);
    elRef.current = el;

    const tryPlay = () => { el.play().catch(() => {}); };

    let cancelled = false;
    attachHls(el, streamUrl)
      .then((h) => { if (cancelled) h.destroy(); else { handleRef.current = h; tryPlay(); } })
      .catch(() => {});

    const onPlaying = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener('playing', onPlaying);
    el.addEventListener('pause', onPause);
    el.addEventListener('canplay', tryPlay);
    el.addEventListener('loadeddata', tryPlay);

    // Stall detection: while the element is meant to be playing, watch the playhead advance. If it
    // freezes (HLS window stopped growing — the restreamer PC died/slept), stalledMs climbs; the
    // transport uses it to fall back to WebRTC instead of leaving the listener in silence.
    let lastTime = el.currentTime;
    let stalledSince = 0;
    const iv = setInterval(() => {
      let ahead = 0;
      for (let i = 0; i < el.buffered.length; i++) {
        if (el.currentTime >= el.buffered.start(i) && el.currentTime <= el.buffered.end(i) + 0.5) {
          ahead = el.buffered.end(i) - el.currentTime;
        }
      }
      setBufferedAhead(ahead);
      if (ahead >= HEALTHY_BUFFER_S) setReady(true);
      if (el.paused) tryPlay();

      const advanced = el.currentTime > lastTime + 0.05;
      lastTime = el.currentTime;
      if (el.paused || advanced) {
        stalledSince = 0;
        setStalledMs(0);
      } else {
        if (stalledSince === 0) stalledSince = Date.now();
        setStalledMs(Date.now() - stalledSince);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearInterval(iv);
      el.removeEventListener('playing', onPlaying);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('canplay', tryPlay);
      el.removeEventListener('loadeddata', tryPlay);
      handleRef.current?.destroy();
      handleRef.current = null;
      el.pause();
      el.remove();
      elRef.current = null;
      setReady(false);
      setPlaying(false);
      setBufferedAhead(0);
      setStalledMs(0);
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

  // Once HLS is the audible transport, claim the OS media session so the audio survives a phone
  // lock / backgrounding (a bare hidden <video> otherwise gets suspended). This is what lets HLS do
  // what WebRTC never could.
  const claimMediaSession = useCallback(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const ms = navigator.mediaSession;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const MM = (window as any).MediaMetadata;
      if (MM) ms.metadata = new MM({ title: 'Subspace Radio', artist: 'Subspace Resonator' });
      ms.playbackState = 'playing';
      ms.setActionHandler('play', () => { void elRef.current?.play().catch(() => {}); });
      ms.setActionHandler('pause', () => { elRef.current?.pause(); });
    } catch { /* MediaSession unsupported — non-fatal */ }
  }, []);

  const destroy = useCallback(() => {
    handleRef.current?.destroy();
    handleRef.current = null;
  }, []);

  return { ready, playing, bufferedAhead, stalledMs, play, setVolume, claimMediaSession, destroy };
}
