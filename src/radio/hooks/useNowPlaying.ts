import { useState, useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { peekVisibleAt, type NowPlayingPayload } from '../nowPlaying';

export interface UseNowPlayingResult {
  name: string;
  visible: boolean;
}

// Listens for the host's now-playing broadcasts and reveals the current track name on the
// fixed peek schedule (15s every 60s + on track change). The host's old art/mode fields are
// ignored — the track name now folds into the stage banner instead of a separate card.
export function useNowPlaying(supabase: SupabaseClient): UseNowPlayingResult {
  const [name, setName] = useState('');
  const [visible, setVisible] = useState(false);
  const startRef = useRef(Date.now());
  const trackChangeRef = useRef(-1); // timestamp of last track change; -1 = none yet

  useEffect(() => {
    const ch = supabase.channel('room:nowplaying', { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'np' }, ({ payload }) => {
      const next = ((payload ?? {}) as Partial<NowPlayingPayload>).name ?? '';
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
      setVisible(name ? peekVisibleAt(elapsed, since) : false);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [name]);

  return { name, visible };
}
