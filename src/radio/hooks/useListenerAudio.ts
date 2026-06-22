import { useState, useEffect, useRef, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Station } from '../types';

export interface UseListenerAudioResult {
  playing: boolean;
  /** True once the host's stream is attached, even if autoplay was blocked. */
  ready: boolean;
  /** True when the connection failed or timed out. Show a retry button. */
  connectionError: boolean;
  /** Manually start playback from a user gesture (defeats autoplay restrictions). */
  resume: () => void;
  /** Re-attempt the WebRTC connection after a failure. */
  retry: () => void;
  volume: number;
  setVolume: (v: number) => void;
  audioElement: HTMLAudioElement | null;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const sessionTokenRef = useRef<string>('');
  const subscriberRef = useRef<{ setBufferMs: (ms: number) => void } | null>(null);
  const bufferMsRef = useRef(5000);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().then(() => setPlaying(true)).catch(() => {});
  }, []);

  const retry = useCallback(() => {
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

  useEffect(() => {
    if (!cfSessionId) {
      cleanupRef.current?.();
      cleanupRef.current = null;
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
        audioRef.current = audio;

        const sub = new Subscriber(
          {
            onStreamReady: (stream: MediaStream) => {
              audio.srcObject = stream;
              setReady(true);
              audio.play().then(() => setPlaying(true)).catch(() => {});
            },
            onDispatch: (event) => {
              if (event.type === 'DISCONNECTED' || event.type === 'ERROR') {
                setPlaying(false);
                setConnectionError(true);
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
          audio.pause();
          audio.srcObject = null;
          audioRef.current = null;
          subscriberRef.current = null;
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

  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  return {
    playing,
    ready,
    connectionError,
    resume,
    retry,
    volume,
    setVolume,
    audioElement: audioRef.current,
  };
}
