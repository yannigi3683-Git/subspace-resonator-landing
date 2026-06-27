import { useState, useEffect, useRef, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PresenceEntry, Identity } from '../types';
import { updateIdentity } from '../identity';

export interface UsePresenceResult {
  presenceList: PresenceEntry[];
  count: number;
  isKicked: boolean;
  isBanned: boolean;
  rename: (name: string, avatarId: string) => void;
}

/**
 * Collapse presence entries from the same browser down to one (keeping the most recent).
 * Supabase presence is keyed per connection, and anonymous re-auth mints a new uid, so a stale
 * ghost (old uid) can sit beside the current entry (new uid) — both from the same device. Keying
 * on the stable deviceId (falling back to uid for legacy/ghost entries) collapses that duplicate.
 */
export function dedupeByDevice(list: PresenceEntry[]): PresenceEntry[] {
  const byDevice = new Map<string, PresenceEntry>();
  for (const entry of list) byDevice.set(entry.deviceId || entry.uid, entry);
  return [...byDevice.values()];
}

export function usePresence(supabase: SupabaseClient, identity: Identity, uid: string): UsePresenceResult {
  const [presenceList, setPresenceList] = useState<PresenceEntry[]>([]);
  const [isKicked, setIsKicked] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase.channel('room:main', { config: { private: true } });
    channelRef.current = channel;

    const syncPresence = () => {
      const state = channel.presenceState<{ uid: string; name: string; avatarId: string; deviceId?: string; position: { x: number; y: number } }>();
      const list: PresenceEntry[] = Object.values(state).flat().map((p) => ({
        uid: p.uid,
        name: p.name,
        avatarId: p.avatarId,
        deviceId: p.deviceId,
        position: p.position,
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

  return { presenceList, count: presenceList.length, isKicked, isBanned, rename };
}
