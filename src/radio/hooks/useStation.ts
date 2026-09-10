import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Station } from '../types';

const RESYNC_MS = 60_000;

export function useStation(supabase: SupabaseClient): Station | null {
  const [station, setStation] = useState<Station | null>(null);

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      const { data, error } = await supabase
        .from('station')
        .select('mode, live_title, live_session, slow_mode_s, locked')
        .single();
      if (!cancelled && data && !error) setStation(data as Station);
    };

    void read();

    const channel = supabase
      .channel('station-watch')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'station' },
        (payload) => {
          if (!cancelled) setStation(payload.new as Station);
        },
      )
      .subscribe();

    // ponytail: one snapshot at mount plus a stream of deltas has no way back to truth if the
    // stream is interrupted, and this subscription is never rebuilt. Seen live 2026-08-21: the host
    // reconnected at 11:52 and the server wrote a new streamUrl, the console never received the
    // UPDATE, and the DEEP BUFFER badge went on probing the previous session's playlist — which R2
    // still serves, frozen, because nothing deletes old prefixes — so it read STALLED for the rest
    // of the show while the deep buffer was in fact healthy. A plain re-read is the cheap way back:
    // no channel teardown, no socket effects, one indexed single-row select.
    //
    // Skipped while hidden, and repeated on return, because a backgrounded tab has its timers
    // clamped anyway and coming back is exactly when someone is about to read the number. One read
    // per visible client per minute; the whole point is that it costs almost nothing.
    const resync = () => { if (!document.hidden) void read(); };
    const timer = setInterval(resync, RESYNC_MS);
    document.addEventListener('visibilitychange', resync);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', resync);
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return station;
}
