import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage, Identity } from '../types';
import { validateMessage, chatReloadFloor, buildReplySnippet } from '../chatRules';

const MAX_MESSAGES = 100;

export interface SendOptions {
  replyTo?: ChatMessage | null;
}

export interface UseChatResult {
  messages: ChatMessage[];
  sendMessage: (body: string, opts?: SendOptions) => Promise<void>;
  sending: boolean;
  sendError: string | null;
}

// Keyed on startedAt (the broadcast), never on cfSessionId (the connection): a host network
// drop re-publishes with a new cfSessionId mid-show, and re-keying on that blanked every
// listener's chat box and refetched it. startedAt only changes on a real go-live.
export function useChat(supabase: SupabaseClient, identity: Identity, uid: string, startedAt?: string): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);

    // Reload from the broadcast's start time so a mid-broadcast joiner sees the whole
    // broadcast's chat; resets when a new broadcast starts (new startedAt).
    const sinceIso = chatReloadFloor(startedAt, Date.now());
    supabase
      .from('chat_messages')
      .select('id, uid, display_name, avatar_id, body, is_host, created_at, reply_to_id, reply_to_name, reply_to_body')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(MAX_MESSAGES)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const loaded = (data as ChatMessage[]).reverse();
        setMessages((prev) => {
          // Merge with any realtime inserts that landed while this query was in flight.
          const seen = new Set(prev.map((m) => m.id));
          const merged = [...loaded.filter((m) => !seen.has(m.id)), ...prev];
          return merged.length > MAX_MESSAGES ? merged.slice(-MAX_MESSAGES) : merged;
        });
      });

    const channel = supabase
      .channel(`chat-inserts-${startedAt ?? 'default'}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          if (cancelled) return;
          setMessages((prev) => {
            const next = [...prev, payload.new as ChatMessage];
            return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
          });
        },
      )
      // A message the host deletes has to leave every screen at once, not at the next reload.
      // DELETE payloads carry only the primary key (default replica identity), which is all
      // that is needed to drop it.
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages' },
        (payload) => {
          if (cancelled) return;
          const deletedId = (payload.old as { id?: string } | null)?.id;
          if (!deletedId) return;
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, startedAt]);

  const sendMessage = useCallback(
    async (body: string, opts?: SendOptions) => {
      const { valid, error } = validateMessage(body);
      if (!valid) {
        setSendError(error ?? 'Invalid message');
        return;
      }
      setSendError(null);
      setSending(true);
      try {
        const replyTo = opts?.replyTo;
        const { error: dbError } = await supabase.from('chat_messages').insert({
          uid,
          device_id: identity.deviceId,
          display_name: identity.name,
          avatar_id: identity.avatarId,
          body: body.trim(),
          is_host: false,
          reply_to_id: replyTo?.id ?? null,
          reply_to_name: replyTo?.display_name ?? null,
          reply_to_body: replyTo ? buildReplySnippet(replyTo) : null,
        });
        if (dbError) {
          if (dbError.code === '23514') {
            setSendError('Cannot send: station locked, slow mode, or you are banned.');
          } else {
            setSendError(dbError.message);
          }
        }
      } finally {
        setSending(false);
      }
    },
    [supabase, uid, identity.deviceId, identity.name, identity.avatarId],
  );

  return { messages, sendMessage, sending, sendError };
}
