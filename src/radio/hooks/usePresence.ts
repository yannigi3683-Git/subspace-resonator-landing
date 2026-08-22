import { useState, useEffect, useRef, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PresenceEntry, Identity } from '../types';
import { updateIdentity } from '../identity';
import { usePresenceObserver } from './usePresenceObserver';

export interface UsePresenceResult {
  presenceList: PresenceEntry[];
  count: number;
  isKicked: boolean;
  isBanned: boolean;
  rename: (name: string, avatarId: string) => void;
  /** Broadcast a "happy" pulse to the room. Rate limited; returns false when the tap was dropped. */
  cheer: () => boolean;
}

// track() rebroadcasts to every subscriber, so an unthrottled button at 120 listeners is a
// presence storm competing with the audio stream. Enforced in the hook, not the button, so a
// second trigger cannot bypass it.
export const CHEER_COOLDOWN_MS = 3000;

export function usePresence(supabase: SupabaseClient, identity: Identity, uid: string): UsePresenceResult {
  // Who is in the room comes from a rejoining observer, NOT from this hook's own channel. This one
  // track()s, so rebuilding it to re-prune would broadcast leave+join to the whole room every cycle
  // and teleport this listener's avatar on every other screen. The observer never tracks, so it can
  // rejoin freely. Measured 2026-08-22: the dance floor showed ~21 while the server held 12.
  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? '';
  }, [supabase]);
  const presenceList = usePresenceObserver(getToken);

  const [isKicked, setIsKicked] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase.channel('room:main', { config: { private: true } });
    channelRef.current = channel;

    // These three bindings are load-bearing even though they do nothing: supabase-js only enables
    // presence on a channel that has presence bindings, and without them track() has nothing to
    // write to. The roster itself is read from the observer, not from here.
    channel
      .on('presence', { event: 'sync' }, () => {})
      .on('presence', { event: 'join' }, () => {})
      .on('presence', { event: 'leave' }, () => {})
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'kicks' },
        (payload) => {
          const row = payload.new as { uid: string; device_id: string };
          if (row.uid === uid || row.device_id === identity.deviceId) {
            setIsKicked(true);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bans' },
        (payload) => {
          const row = payload.new as { uid: string; device_id: string };
          if (row.uid === uid || row.device_id === identity.deviceId) {
            localStorage.setItem('radio_banned', '1');
            setIsBanned(true);
          }
        },
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            uid,
            name: identity.name,
            avatarId: identity.avatarId,
            deviceId: identity.deviceId,
            position: identity.position,
          });
        }
      });

    return () => {
      channelRef.current = null;
      // Drop this device's presence meta immediately so a tab close / rename re-subscribe
      // doesn't leave a ghost lingering until the server's heartbeat timeout.
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel);
    };
  }, [supabase, uid, identity.name, identity.avatarId, identity.deviceId, identity.position.x, identity.position.y]);

  const lastCheerRef = useRef(0);
  const cheer = useCallback(() => {
    const now = Date.now();
    if (!channelRef.current || now - lastCheerRef.current < CHEER_COOLDOWN_MS) return false;
    lastCheerRef.current = now;
    // Re-track rather than send a broadcast event: presence is already the room's shared state,
    // and a re-track reaches late joiners' first sync too.
    channelRef.current.track({
      uid,
      name: identity.name,
      avatarId: identity.avatarId,
      deviceId: identity.deviceId,
      position: identity.position,
      cheerAt: now,
    }).catch(() => {});
    return true;
  }, [uid, identity.name, identity.avatarId, identity.deviceId, identity.position.x, identity.position.y]); // eslint-disable-line react-hooks/exhaustive-deps

  const rename = useCallback((name: string, avatarId: string) => {
    if (!channelRef.current) return;
    updateIdentity(name, avatarId);
    channelRef.current.track({
      uid,
      name,
      avatarId,
      deviceId: identity.deviceId,
      position: identity.position,
    }).catch(() => {});
  }, [uid, identity.position.x, identity.position.y]); // eslint-disable-line react-hooks/exhaustive-deps

  return { presenceList, count: presenceList.length, isKicked, isBanned, rename, cheer };
}
