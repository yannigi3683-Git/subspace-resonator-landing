import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage, Identity } from '../types';
import { validateMessage } from '../chatRules';

const MAX_MESSAGES = 100;

export interface UseChatResult {
  messages: ChatMessage[];
  sendMessage: (body: string) => Promise<void>;
  sending: boolean;
  sendError: string | null;
}

export function useChat(supabase: SupabaseClient, identity: Identity, uid: string): UseChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('chat_messages')
      .select('id, uid, display_name, avatar_id, body, is_host, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled && data) {
          setMessages((data as ChatMessage[]).reverse());
        }
      });

    const channel = supabase
      .channel('chat-inserts')
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
  }, [supabase]);

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
    [supabase, identity, uid],
  );

  return { messages, sendMessage, sending, sendError };
}
