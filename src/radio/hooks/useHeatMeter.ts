import { useState, useEffect, useRef, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { aggregateHeat, VOTE_TTL_MS } from '../heatMeter';

export interface UseHeatMeterResult {
  /** Live crowd heat, 0 (cool) .. 1 (hot). */
  heat: number;
  /** This listener's last vote, or null. */
  myVote: number | null;
  /** Cast a vote (0 = cool, 1 = hot). */
  vote: (value: number) => void;
}

// Crowd vibe meter over a Supabase broadcast channel. Each listener broadcasts its vote;
// everyone keeps a TTL'd map of votes and shows the rolling average. Ephemeral by design.
export function useHeatMeter(supabase: SupabaseClient, uid: string): UseHeatMeterResult {
  const [heat, setHeat] = useState(0.5);
  const [myVote, setMyVote] = useState<number | null>(null);
  const votesRef = useRef<Map<string, { v: number; ts: number }>>(new Map());
  const channelRef = useRef<ReturnType<SupabaseClient['channel']> | null>(null);

  const recompute = useCallback(() => {
    setHeat(aggregateHeat([...votesRef.current.values()].map((e) => e.v)));
  }, []);

  useEffect(() => {
    const ch = supabase.channel('room:heat', { config: { broadcast: { self: true } } });
    ch.on('broadcast', { event: 'vote' }, ({ payload }) => {
      const p = payload as { uid?: string; value?: number };
      if (typeof p?.uid === 'string' && Number.isFinite(p.value)) {
        votesRef.current.set(p.uid, { v: p.value as number, ts: Date.now() });
        recompute();
      }
    }).subscribe();
    channelRef.current = ch;

    // Prune stale votes so the needle tracks the live crowd.
    const prune = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [k, e] of votesRef.current) {
        if (now - e.ts > VOTE_TTL_MS) {
          votesRef.current.delete(k);
          changed = true;
        }
      }
      if (changed) recompute();
    }, 2_000);

    return () => {
      clearInterval(prune);
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [supabase, recompute]);

  const vote = useCallback(
    (value: number) => {
      setMyVote(value);
      votesRef.current.set(uid, { v: value, ts: Date.now() });
      recompute();
      channelRef.current?.send({ type: 'broadcast', event: 'vote', payload: { uid, value } });
    },
    [uid, recompute],
  );

  return { heat, myVote, vote };
}
