import { useState, useEffect, useRef, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Station } from '../types';

export interface UseListenerAudioResult {
  playing: boolean;
  volume: number;
  setVolume: (v: number) => void;
  audioElement: HTMLAudioElement | null;
}

export function useListenerAudio(
  supabase: SupabaseClient,
  station: Station | null,
): UseListenerAudioResult {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const sessionTokenRef = useRef<string>('');

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
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
            onStreamReady: (stream) => {
              audio.srcObject = stream;
              audio.play().then(() => setPlaying(true)).catch(() => {});
            },
            onDispatch: (event) => {
              if (event.type === 'DISCONNECTED' || event.type === 'ERROR') {
                setPlaying(false);
              }
            },
          },
          '/api/rtc-session',
          async () => sessionTokenRef.current,
        );

        sub.connect().catch(() => {});

        cleanupRef.current = () => {
          sub.disconnect();
          audio.pause();
          audio.srcObject = null;
          audioRef.current = null;
          setPlaying(false);
        };
      } catch {
        // WebRTC not available (tests, server-side)
      }
    }).catch(() => {});

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // volume intentionally excluded: setVolume updates audio.volume directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfSessionId]);

  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  return { playing, volume, setVolume, audioElement: audioRef.current };
}
