import { useState, useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveVisible, type NowPlayingMode, type NowPlayingPayload } from '../nowPlaying';

export interface UseNowPlayingResult {
  name: string;
  visible: boolean;
}

// Listens for the host's now-playing broadcasts and reveals the current track name in the stage
// banner according to the host's SHOW TO LISTENERS mode: OFF (never), ALWAYS (continuous), or PEEK
// (15s every 60s + on track change). Defaults to peek until the host's first broadcast arrives;
// the host's 4s heartbeat re-sends the mode so late joiners converge.
export function useNowPlaying(supabase: SupabaseClient): UseNowPlayingResult {
  const [name, setName] = useState('');
  const [visible, setVisible] = useState(false);
  const startRef = useRef(Date.now());
  const trackChangeRef = useRef(-1); // timestamp of last track change; -1 = none yet
  const modeRef = useRef<NowPlayingMode>('peek');

  useEffect(() => {
    const ch = supabase.channel('room:nowplaying', { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'np' }, ({ payload }) => {
      const p = (payload ?? {}) as Partial<NowPlayingPayload>;
      modeRef.current = p.mode ?? 'peek';
      const next = p.name ?? '';
      setName((prev) => {
        if (next && next !== prev) trackChangeRef.current = Date.now();
        return next;
      });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const elapsed = now - startRef.current;
      const since = trackChangeRef.current >= 0 ? now - trackChangeRef.current : -1;
      setVisible(resolveVisible(name, modeRef.current, elapsed, since));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [name]);

  return { name, visible };
}
