import { useState, useEffect, useRef, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Station } from '../types';

export interface UseListenerAudioResult {
  playing: boolean;
  /** True once the host's stream is attached, even if autoplay was blocked. */
  ready: boolean;
  /** Manually start playback from a user gesture (defeats autoplay restrictions). */
  resume: () => void;
  volume: number;
  setVolume: (v: number) => void;
  audioElement: HTMLAudioElement | null;
  /** Live frequency spectrum for the visualizer, or null before the stream attaches. */
  getFrequencyData: () => Uint8Array | null;
}

export function useListenerAudio(
  supabase: SupabaseClient,
  station: Station | null,
): UseListenerAudioResult {
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const sessionTokenRef = useRef<string>('');
  const analyserCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const subscriberRef = useRef<{ setBufferMs: (ms: number) => void } | null>(null);
  const bufferMsRef = useRef(1500);

  const getFrequencyData = useCallback((): Uint8Array | null => {
    const a = analyserRef.current;
    if (!a) return null;
    const data = new Uint8Array(a.frequencyBinCount);
    a.getByteFrequencyData(data);
    return data;
  }, []);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().then(() => setPlaying(true)).catch(() => {});
    analyserCtxRef.current?.resume().catch(() => {});
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
              // Autoplay may be blocked until the listener interacts; resume() covers that.
              audio.play().then(() => setPlaying(true)).catch(() => {});

              // Tap the stream for the visualizer. Route analyser → silent gain →
              // destination so the graph stays pulled without adding audible output
              // (the <audio> element already plays the sound).
              try {
                const Ctor = window.AudioContext;
                if (Ctor) {
                  const actx = new Ctor();
                  analyserCtxRef.current = actx;
                  const srcNode = actx.createMediaStreamSource(stream);
                  const an = actx.createAnalyser();
                  an.fftSize = 256;
                  an.smoothingTimeConstant = 0.8;
                  const sink = actx.createGain();
                  sink.gain.value = 0;
                  srcNode.connect(an);
                  an.connect(sink);
                  sink.connect(actx.destination);
                  analyserRef.current = an;
                }
              } catch {
                // Analysis is optional; visualizer just stays idle.
              }
            },
            onDispatch: (event) => {
              if (event.type === 'DISCONNECTED' || event.type === 'ERROR') {
                setPlaying(false);
              }
            },
          },
          '/api/rtc-session',
          async () => sessionTokenRef.current,
          bufferMsRef.current,
        );
        subscriberRef.current = sub;

        sub.connect().catch(() => {});

        cleanupRef.current = () => {
          sub.disconnect();
          audio.pause();
          audio.srcObject = null;
          audioRef.current = null;
          subscriberRef.current = null;
          analyserCtxRef.current?.close().catch(() => {});
          analyserCtxRef.current = null;
          analyserRef.current = null;
          setPlaying(false);
          setReady(false);
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

  return { playing, ready, resume, volume, setVolume, audioElement: audioRef.current, getFrequencyData };
}
