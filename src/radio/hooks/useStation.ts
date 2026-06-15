import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Station } from '../types';

export function useStation(supabase: SupabaseClient): Station | null {
  const [station, setStation] = useState<Station | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('station')
      .select('mode, live_title, live_session, slow_mode_s, locked')
      .single()
      .then(({ data, error }) => {
        if (!cancelled && data && !error) setStation(data as Station);
      });

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

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return station;
}
