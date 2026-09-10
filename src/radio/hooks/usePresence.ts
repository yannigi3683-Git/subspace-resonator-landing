import { useState, useEffect, useRef, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PresenceEntry, Identity } from '../types';
import { updateIdentity } from '../identity';
import { dedupeByDevice } from './usePresenceObserver';

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
  // This roster drifts upward on a long session, and that is a DELIBERATE trade, not an oversight.
  // Only a fresh presence_state prunes a presence map, so staying accurate means rejoining, and
  // rejoining a channel that track()s is not free: it would either storm the room with leave+join
  // every cycle, or need a second Realtime client per listener. The second client is what was built
  // and then rejected — Supabase Free allows **200 concurrent clients** (dashboard, 2026-08-23), so
  // two per listener halves the room from ~200 people to ~100. Capacity beats a tidy number, and a
  // listener can always refresh the page, which recounts from scratch. The HOST cannot refresh (that
  // tab owns the publisher), which is why AdminConsole alone pays for an observer.
  const [presenceList, setPresenceList] = useState<PresenceEntry[]>([]);
  const [isKicked, setIsKicked] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase.channel('room:main', { config: { private: true } });
    channelRef.current = channel;

    const syncPresence = () => {
      const state = channel.presenceState<{ uid: string; name: string; avatarId: string; deviceId?: string; position: { x: number; y: number }; cheerAt?: number }>();
      const list: PresenceEntry[] = Object.values(state).flat().map((p) => ({
        uid: p.uid,
        name: p.name,
        avatarId: p.avatarId,
        deviceId: p.deviceId,
        position: p.position,
        cheerAt: p.cheerAt,
      }));
      setPresenceList(dedupeByDevice(list));
    };

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, syncPresence)
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
