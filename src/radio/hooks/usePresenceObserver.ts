import { useState, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { makeSupabase } from '../supabaseClient';
import type { PresenceEntry } from '../types';

export const OBSERVER_REBUILD_MS = 60_000;

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

interface PresenceMeta {
  uid: string;
  name: string;
  avatarId: string;
  deviceId?: string;
  position: { x: number; y: number };
  cheerAt?: number;
}

/**
 * Who is in the room, read from a channel that is periodically rejoined.
 *
 * A presence map is one `presence_state` snapshot plus accumulated `presence_diff`, and **only a
 * fresh `presence_state` prunes**. A subscription that never reconnects never gets a second one, so
 * a missed leave is permanent and the count can only drift upward. Measured on the 2026-08-22 public
 * broadcast: the host console read 21 and the guest dance floor read ~21 while the server held 12 —
 * two different browsers on two different machines, wrong by the same +9, because neither had
 * re-pruned since page load.
 *
 * Rejoining is the only way to re-prune, so this observer does exactly that on a timer, and re-auths
 * first because `room:main` is private and Realtime re-authorizes it against a token that expires
 * long before the tab is closed.
 *
 * It runs on its OWN Supabase client for two reasons, not one:
 *  - `channel(topic)` returns the *existing* channel for a matching topic, so a second `room:main`
 *    on the caller's client would just hand back the caller's own tracking channel.
 *  - it never calls `track()`, so rejoining is invisible to everyone else. Rebuilding a channel that
 *    tracks would broadcast a leave and a join to the whole room every cycle, which at crowd scale
 *    is a presence storm, and would re-seed the leaver's avatar at a new random position on every
 *    other screen (`useCrowdMotion` keys agents by uid).
 */
export function usePresenceObserver(getToken: () => Promise<string>): PresenceEntry[] {
  const [list, setList] = useState<PresenceEntry[]>([]);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    // persistSession/autoRefreshToken off, and its own storageKey: two GoTrue clients sharing the
    // default key on one origin both refresh the same session and can knock the user out. This one
    // is fed tokens by hand and must never touch auth storage.
    const observer = makeSupabase({
      persistSession: false,
      autoRefreshToken: false,
      storageKey: 'sb-radio-presence-observer',
    });
    if (!observer) return;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const sync = (ch: RealtimeChannel) => {
      const state = ch.presenceState<PresenceMeta>();
      setList(dedupeByDevice(Object.values(state).flat().map((p) => ({
        uid: p.uid,
        name: p.name,
        avatarId: p.avatarId,
        deviceId: p.deviceId,
        position: p.position,
        cheerAt: p.cheerAt,
      }))));
    };

    // Never clears the list: the replacement's first presence_state lands a moment after the
    // teardown, and emptying the room in between would blank the roster and re-seed every avatar
    // once a minute.
    const build = async () => {
      try {
        await observer.realtime.setAuth(await getTokenRef.current());
      } catch {
        return; // next rebuild retries; the last known roster stays on screen
      }
      if (cancelled) return;
      const ch = observer.channel('room:main', { config: { private: true } });
      channel = ch;
      ch
        .on('presence', { event: 'sync' }, () => sync(ch))
        .on('presence', { event: 'join' }, () => sync(ch))
        .on('presence', { event: 'leave' }, () => sync(ch))
        // Logged, not swallowed: a silently dropped channel is how the count drifted in the first place.
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') console.warn('[radio] presence observer:', status);
        });
    };

    void build();

    // Remove THEN create, because channel(topic) returns the existing channel for a matching topic.
    const timer = setInterval(() => {
      void (async () => {
        if (channel) await observer.removeChannel(channel);
        channel = null;
        if (!cancelled) await build();
      })();
    }, OBSERVER_REBUILD_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (channel) void observer.removeChannel(channel);
      void observer.realtime.disconnect();
    };
  }, []);

  return list;
}
