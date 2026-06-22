import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage, Identity } from '../types';
import { validateMessage, chatSinceFloor } from '../chatRules';

// Remember when this browser first saw a broadcast session, so a refresh reloads the
// same broadcast's chat instead of wiping it. A new broadcast (new cfSessionId) has no
// stored marker, so its chat starts empty.
function sessionFirstSeen(sessionId: string | undefined): string | null {
  if (!sessionId) return null;
  try {
    const key = `radio_chat_seen_${sessionId}`;
    const saved = localStorage.getItem(key);
    if (saved) return saved;
    const nowIso = new Date().toISOString();
    localStorage.setItem(key, nowIso);
    return nowIso;
  } catch {
    return null;
  }
}

const MAX_MESSAGES = 100;

export interface UseChatResult {
  messages: ChatMessage[];
  sendMessage: (body: string) => Promise<void>;
  sending: boolean;
  sendError: string | null;
}

export function useChat(supabase: SupabaseClient, identity: Identity, uid: string, sessionId?: string): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);

    // Reload the current broadcast's chat (survives refresh; resets per broadcast/date).
    const sinceIso = chatSinceFloor(sessionFirstSeen(sessionId), Date.now());
    supabase
      .from('chat_messages')
      .select('id, uid, display_name, avatar_id, body, is_host, created_at')
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
      .channel(`chat-inserts-${sessionId ?? 'default'}`)
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
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [supabase, sessionId]);

  const sendMessage = useCallback(
    async (body: string) => {
      const { valid, error } = validateMessage(body);
      if (!valid) {
        setSendError(error ?? 'Invalid message');
        return;
      }
      setSendError(null);
      setSending(true);
      try {
        const { error: dbError } = await supabase.from('chat_messages').insert({
          uid,
          device_id: identity.deviceId,
          display_name: identity.name,
          avatar_id: identity.avatarId,
          body: body.trim(),
          is_host: false,
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
