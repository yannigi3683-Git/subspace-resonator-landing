import { useCallback, useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Sample { offset: number; rtt: number }

export function useServerClock(supabase: SupabaseClient): () => Date {
  const offsetRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const samples: Sample[] = [];
      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        const { data } = await supabase.rpc('get_server_time');
        const t1 = Date.now();
        if (data) {
          const rtt = t1 - t0;
          const serverMs = new Date(data as string).getTime();
          samples.push({ offset: serverMs - (t0 + rtt / 2), rtt });
        }
      }
      if (cancelled || samples.length === 0) return;
      const best = samples.reduce((a, b) => (a.rtt < b.rtt ? a : b));
      offsetRef.current = best.offset;
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  const getServerTime = useCallback(() => new Date(Date.now() + offsetRef.current), []);
  return getServerTime;
}
