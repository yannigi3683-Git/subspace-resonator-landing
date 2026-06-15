import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PresenceEntry, Identity } from '../types';

export interface UsePresenceResult {
  presenceList: PresenceEntry[];
  count: number;
  isKicked: boolean;
  isBanned: boolean;
}

export function usePresence(supabase: SupabaseClient, identity: Identity, uid: string): UsePresenceResult {
  const [presenceList, setPresenceList] = useState<PresenceEntry[]>([]);
  const [isKicked, setIsKicked] = useState(false);
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    const channel = supabase.channel('room:main', { config: { private: true } });

    const syncPresence = () => {
      const state = channel.presenceState<{ uid: string; name: string; avatarId: string; position: { x: number; y: number } }>();
      const list: PresenceEntry[] = Object.values(state).flat().map((p) => ({
        uid: p.uid,
        name: p.name,
        avatarId: p.avatarId,
        position: p.position,
      }));
      setPresenceList(list);
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
            position: identity.position,
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, identity, uid]);

  return { presenceList, count: presenceList.length, isKicked, isBanned };
}
