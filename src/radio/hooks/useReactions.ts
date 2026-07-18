import { useState, useEffect, useMemo, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Identity, Reaction } from '../types';
import { aggregateReactions, chatReloadFloor, type ReactionSummary } from '../chatRules';

export interface UseReactionsResult {
  reactions: Record<string, ReactionSummary[]>;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
}

// Reactions ride their own postgres_changes channel (INSERT + DELETE). State is the raw
// row set; per-message tallies are derived (aggregateReactions). No optimistic update —
// we rely on the realtime echo, same as useChat. ponytail: add optimism only if it lags.
export function useReactions(
  supabase: SupabaseClient,
  identity: Identity,
  uid: string,
  sessionId?: string,
  startedAt?: string,
): UseReactionsResult {
  const [rows, setRows] = useState<Reaction[]>([]);

  useEffect(() => {
    let cancelled = false;
    setRows([]);

    const sinceIso = chatReloadFloor(startedAt, Date.now());
    supabase
      .from('chat_reactions')
      .select('id, message_id, uid, emoji')
      .gte('created_at', sinceIso)
      .then(({ data }) => {
        if (cancelled || !data) return;
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...(data as Reaction[]).filter((r) => !seen.has(r.id)), ...prev];
        });
      });

    const channel = supabase
      .channel(`reactions-${sessionId ?? 'default'}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_reactions' },
        (payload) => {
          if (cancelled) return;
          const row = payload.new as Reaction;
          setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_reactions' },
        (payload) => {
          if (cancelled) return;
          const gone = payload.old as { id?: string };
          if (!gone.id) return;
          setRows((prev) => prev.filter((r) => r.id !== gone.id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, sessionId, startedAt]);

  const reactions = useMemo(() => aggregateReactions(rows, uid), [rows, uid]);

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const mine = rows.find((r) => r.message_id === messageId && r.emoji === emoji && r.uid === uid);
      if (mine) {
        await supabase.from('chat_reactions').delete().eq('id', mine.id);
      } else {
        await supabase.from('chat_reactions').insert({
          message_id: messageId,
          uid,
          device_id: identity.deviceId,
          emoji,
        });
      }
    },
    [supabase, rows, uid, identity.deviceId],
  );

  return { reactions, toggleReaction };
}
