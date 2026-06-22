import { useState, useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { nowPlayingVisible, type NowPlayingMode, type NowPlayingPayload } from '../nowPlaying';

export interface UseNowPlayingResult {
  name: string;
  art: string | null;
  visible: boolean;
}

// Listens for the host's now-playing broadcasts on the control channel and applies the
// host-chosen display mode (off / always / peek) entirely on the listener side.
export function useNowPlaying(supabase: SupabaseClient): UseNowPlayingResult {
  const [state, setState] = useState<{ name: string; art: string | null; mode: NowPlayingMode }>(
    { name: '', art: null, mode: 'always' },
  );
  const [visible, setVisible] = useState(false);
  const startRef = useRef(Date.now());
  const trackChangeRef = useRef(-1); // timestamp of last track change; -1 = none yet

  useEffect(() => {
    const ch = supabase.channel('room:nowplaying', { config: { broadcast: { self: false } } });
    ch.on('broadcast', { event: 'np' }, ({ payload }) => {
      const p = (payload ?? {}) as Partial<NowPlayingPayload>;
      setState((prev) => {
        const name = p.name ?? '';
        if (name && name !== prev.name) trackChangeRef.current = Date.now();
        return { name, art: p.art ?? null, mode: (p.mode as NowPlayingMode) ?? 'always' };
      });
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const elapsed = now - startRef.current;
      const since = trackChangeRef.current >= 0 ? now - trackChangeRef.current : -1;
      setVisible(state.name ? nowPlayingVisible(state.mode, elapsed, since) : false);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state.mode, state.name]);

  return { name: state.name, art: state.art, visible };
}
