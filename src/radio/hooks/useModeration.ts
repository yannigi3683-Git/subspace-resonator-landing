import { useState, useEffect, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

// The host moderates from inside the guest room. Listeners are anonymous aal1 sessions; only
// the TOTP host sign-in reaches aal2, which is exactly what the server requires. This is a UI
// hint only — every action below is re-authorized server-side.
export function readAal(accessToken: string | null | undefined): string {
  if (!accessToken) return 'aal1';
  try {
    const part = accessToken.split('.')[1];
    if (!part) return 'aal1';
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(padded)) as { aal?: string };
    return payload.aal ?? 'aal1';
  } catch {
    return 'aal1';
  }
}

export function moderationErrorMessage(status: number, code: string | undefined): string {
  if (status === 403 && code === 'not_aal2') return 'Session expired. Sign in again to moderate.';
  if (status === 403) return 'This account cannot moderate.';
  if (code === 'cannot_moderate_self') return 'That is you.';
  if (code === 'nothing_to_update') return 'Nothing to change.';
  return 'Could not apply that. Try again.';
}

export interface ChatSettings {
  slowModeS?: number;
  locked?: boolean;
}

export interface ModerationApi {
  canModerate: boolean;
  error: string | null;
  clearError: () => void;
  deleteMessage: (messageId: string) => Promise<boolean>;
  kick: (uid: string, deviceId?: string) => Promise<boolean>;
  ban: (uid: string, deviceId?: string, reason?: string) => Promise<boolean>;
  unban: (uid: string) => Promise<boolean>;
  setChat: (settings: ChatSettings) => Promise<boolean>;
}

export function useModeration(supabase: SupabaseClient, apiUrl = '/api/rtc-session'): ModerationApi {
  const [canModerate, setCanModerate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const evaluate = (token: string | null | undefined) => {
      if (!cancelled) setCanModerate(readAal(token) === 'aal2');
    };
    supabase.auth.getSession().then(({ data }) => evaluate(data.session?.access_token));
    // The in-room host sign-in elevates the session in place, so react to it without a reload.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      evaluate(session?.access_token);
    });
    return () => {
      cancelled = true;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase]);

  const post = useCallback(
    async (payload: Record<string, unknown>): Promise<boolean> => {
      setError(null);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) {
          setError('Session expired. Sign in again to moderate.');
          return false;
        }
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ phase: 'moderate', ...payload }),
        });
        if (res.ok) return true;
        const body = (await res.json().catch(() => ({}))) as { error?: string; reason?: string };
        setError(moderationErrorMessage(res.status, body.reason ?? body.error));
        return false;
      } catch {
        setError('Network problem. Try again.');
        return false;
      }
    },
    [supabase, apiUrl],
  );

  return {
    canModerate,
    error,
    clearError: useCallback(() => setError(null), []),
    deleteMessage: useCallback((messageId: string) => post({ action: 'delete_message', messageId }), [post]),
    kick: useCallback((uid: string, deviceId?: string) => post({ action: 'kick', uid, deviceId }), [post]),
    ban: useCallback(
      (uid: string, deviceId?: string, reason?: string) => post({ action: 'ban', uid, deviceId, reason }),
      [post],
    ),
    unban: useCallback((uid: string) => post({ action: 'unban', uid }), [post]),
    setChat: useCallback((settings: ChatSettings) => post({ action: 'set_chat', ...settings }), [post]),
  };
}
