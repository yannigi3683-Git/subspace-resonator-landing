import { useState, useEffect, useRef, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Station } from '../types';
import type { SubscriberStats } from '../rtc/subscriber';

export interface UseListenerAudioResult {
  playing: boolean;
  /** True once the host's stream is attached, even if autoplay was blocked. */
  ready: boolean;
  /** True when the connection failed or timed out. Show a retry button. */
  connectionError: boolean;
  /** True when a user-gesture .play() was rejected (iOS Safari). Show a tap-again hint. */
  playbackBlocked: boolean;
  /** Manually start playback from a user gesture (defeats autoplay restrictions). */
  resume: () => void;
  /** Re-attempt the WebRTC connection after a failure. */
  retry: () => void;
  volume: number;
  setVolume: (v: number) => void;
  audioElement: HTMLAudioElement | null;
  getStats: () => Promise<SubscriberStats | null>;
  /** Count of mid-stream buffer underruns (audio dropouts) since the broadcast started. */
  stalls: number;
}

export function useListenerAudio(
  supabase: SupabaseClient,
  station: Station | null,
): UseListenerAudioResult {
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [stalls, setStalls] = useState(0);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const stallsRef = useRef(0);
  const hasPlayedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const sessionTokenRef = useRef<string>('');
  const subscriberRef = useRef<{ setBufferMs: (ms: number) => void; getStats: () => Promise<SubscriberStats | null> } | null>(null);
  const bufferMsRef = useRef(5000);
  const silentRetryCountRef = useRef(0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Screen Wake Lock: keep the phone awake while a listener is engaged (screen on, chatting)
  // so auto-lock doesn't freeze the page and suspend the WebRTC connection. Feature-detected;
  // the OS auto-releases it when the tab hides, so we re-acquire on visibilitychange.
  const acquireWakeLock = useCallback(async () => {
    try {
      if (
        typeof navigator !== 'undefined' &&
        'wakeLock' in navigator &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        !wakeLockRef.current
      ) {
        const sentinel = await navigator.wakeLock.request('screen');
        wakeLockRef.current = sentinel;
        sentinel.onrelease = () => {
          if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        };
      }
    } catch {
      // Unsupported (iOS < 16.4), denied, or tab hidden — non-fatal, audio still plays.
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  const getStats = useCallback(() => {
    return subscriberRef.current?.getStats() ?? Promise.resolve(null);
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => {
      setPlaybackBlocked(false);
      void acquireWakeLock();
    }).catch(() => {
      // iOS Safari can still refuse to start WebRTC audio even from a tap — surface a hint.
      setPlaybackBlocked(true);
    });
  }, [acquireWakeLock]);

  const retry = useCallback(() => {
    silentRetryCountRef.current = 0;
    setConnectionError(false);
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      sessionTokenRef.current = data.session?.access_token ?? '';
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      sessionTokenRef.current = session?.access_token ?? '';
    });
    return () => { listener.subscription.unsubscribe(); };
  }, [supabase]);

  const cfSessionId = station?.live_session?.cfSessionId;

  // Reset the dropout counter per broadcast (not per silent retry, which is part of the
  // same listening session and whose stalls we want to keep counting).
  useEffect(() => {
    stallsRef.current = 0;
    hasPlayedRef.current = false;
    setStalls(0);
  }, [cfSessionId]);

  useEffect(() => {
    if (!cfSessionId) {
      silentRetryCountRef.current = 0;
      cleanupRef.current?.();
      cleanupRef.current = null;
      releaseWakeLock();
      setPlaying(false);
      setReady(false);
      setConnectionError(false);
      return;
    }

    let cancelled = false;

    import('../rtc/subscriber').then(({ Subscriber }) => {
      if (cancelled) return;
      try {
        const audio = new Audio();
        audio.volume = volume;
        audio.setAttribute('playsinline', '');
        audioRef.current = audio;
        // Source of truth for `playing` is the element's real events, not the one-shot
        // play() promise (which rejects with AbortError on renegotiation/reconnect while
        // audio actually starts, leaving the "TAP TO LISTEN" overlay stuck up).
        audio.onplaying = () => {
          hasPlayedRef.current = true;
          setPlaying(true);
          setPlaybackBlocked(false);
          void acquireWakeLock();
        };
        audio.onpause = () => setPlaying(false);
        // A `waiting`/`stalled` after playback started = a real mid-stream dropout
        // (buffer underrun). Gating on hasPlayed excludes normal startup buffering.
        // onstalled fires spuriously on MediaStream sources (GC pauses, silence, tab throttle).
        // onwaiting is the accurate signal: fires only when the playout buffer genuinely runs dry.
        audio.onwaiting = () => {
          if (hasPlayedRef.current) {
            stallsRef.current += 1;
            setStalls(stallsRef.current);
          }
        };

        const sub = new Subscriber(
          {
            onStreamReady: (stream: MediaStream) => {
              audio.srcObject = stream;
              silentRetryCountRef.current = 0;
              setConnectionError(false);
              setReady(true);
              audio.play().catch(() => {});
            },
            onDispatch: (event) => {
              if (event.type === 'DISCONNECTED' || event.type === 'ERROR') {
                setPlaying(false);
                if (silentRetryCountRef.current < 3) {
                  const attempt = ++silentRetryCountRef.current;
                  setTimeout(() => setRetryKey((k) => k + 1), attempt * 3000);
                } else {
                  silentRetryCountRef.current = 0;
                  setConnectionError(true);
                }
              }
            },
          },
          '/api/rtc-session',
          async () => sessionTokenRef.current,
          bufferMsRef.current,
        );
        subscriberRef.current = sub;

        sub.connect().catch(() => { setConnectionError(true); });

        cleanupRef.current = () => {
          sub.disconnect();
          audio.onplaying = null;
          audio.onpause = null;
          audio.onwaiting = null;
          audio.onstalled = null;
          audio.pause();
          audio.srcObject = null;
          audioRef.current = null;
          subscriberRef.current = null;
          releaseWakeLock();
          setPlaying(false);
          setReady(false);
        };
      } catch {
        // WebRTC not available (tests, server-side)
        setConnectionError(true);
      }
    }).catch(() => { setConnectionError(true); });

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // volume intentionally excluded: setVolume updates audio.volume directly
    // retryKey triggers a fresh connection attempt; cfSessionId guards against no broadcast
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfSessionId, retryKey]);

  // Listen for live broadcast settings from the host (jitter buffer changes) and apply them
  // to the active subscriber. Defensive: failures here never affect playback.
  useEffect(() => {
    const ch = supabase.channel('room:control', { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'buffer' }, ({ payload }) => {
      const ms = Number((payload as { bufferMs?: number })?.bufferMs);
      if (Number.isFinite(ms) && ms > 0) {
        bufferMsRef.current = ms;
        subscriberRef.current?.setBufferMs(ms);
      }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase]);

  // On return to foreground: re-acquire the wake lock; if audio died while the screen was
  // locked (WebRTC suspended on lock), reconnect in place — no page reload. retry() reuses the
  // same join/signaling flow; returning to visible also satisfies iOS autoplay for the fresh stream.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        void acquireWakeLock();
      } else if (cfSessionId && hasPlayedRef.current) {
        retry();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [acquireWakeLock, retry, cfSessionId]);

  useEffect(() => {
    return () => { cleanupRef.current?.(); releaseWakeLock(); };
  }, [releaseWakeLock]);

  return {
    playing,
    ready,
    connectionError,
    playbackBlocked,
    resume,
    retry,
    volume,
    setVolume,
    audioElement: audioRef.current,
    getStats,
    stalls,
  };
}
