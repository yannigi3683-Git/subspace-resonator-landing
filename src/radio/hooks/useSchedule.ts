import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { GRACE_MS, type Show } from '../scheduleRules';

const RESYNC_MS = 60_000;
const PAST_SHOWN = 5;
const COLUMNS = 'id, title, starts_at, aired_at';
const READ_FAILED = 'Could not load the schedule. Retrying every minute.';
const REFUSED = 'The server refused the change: your host sign-in may have expired. Reload the console and sign in again.';

export interface ScheduleApi {
  shows: Show[];
  error: string | null;
  saving: boolean;
  reload: () => Promise<void>;
  add: (title: string, startsAt: string) => Promise<boolean>;
  update: (id: string, patch: { title: string; starts_at: string }) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  markAired: (id: string) => Promise<void>;
}

type Rows = { data: unknown; error: { message: string } | null };

// The host console's view of the schedule. It reads the table directly (every upcoming show plus
// the last few past ones), never the guests' upcoming_shows function, whose limit would hide a
// show from the host. It opens no channel: AdminConsole's shared client must never carry one
// (see usePresenceObserver). Nothing here throws, because the console mounts it beside the live
// GoLivePanel, outside the Schedule tab's error boundary.
export function useSchedule(supabase: SupabaseClient): ScheduleApi {
  const [shows, setShows] = useState<Show[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    try {
      const cutoff = new Date(Date.now() - GRACE_MS).toISOString();
      const [up, past] = (await Promise.all([
        supabase.from('scheduled_shows').select(COLUMNS).gte('starts_at', cutoff).order('starts_at', { ascending: true }),
        supabase.from('scheduled_shows').select(COLUMNS).lt('starts_at', cutoff).order('starts_at', { ascending: false }).limit(PAST_SHOWN),
      ])) as Rows[];
      if (!alive.current) return;
      if (up.error || past.error) {
        setError(READ_FAILED);
        return;
      }
      const all = [...((past.data as Show[]) ?? []), ...((up.data as Show[]) ?? [])];
      all.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
      setShows(all);
      setError((e) => (e === READ_FAILED ? null : e));
    } catch {
      if (alive.current) setError(READ_FAILED);
    }
  }, [supabase]);

  // Every write asks for the changed rows back. RLS refuses an update or delete silently, as 200
  // with zero rows, so "no error" alone would report success for a change that never happened.
  const write = useCallback(
    async (verb: 'Not saved.' | 'Not deleted.', run: () => PromiseLike<Rows>): Promise<boolean> => {
      if (savingRef.current) return false;
      savingRef.current = true;
      setSaving(true);
      try {
        const { data, error: err } = await run();
        const changed = Array.isArray(data) && data.length > 0;
        if (err || !changed) {
          if (alive.current) setError(`${verb} ${REFUSED}`);
          return false;
        }
        if (alive.current) setError(null);
        await reload();
        return true;
      } catch {
        if (alive.current) setError(`${verb} ${REFUSED}`);
        return false;
      } finally {
        savingRef.current = false;
        if (alive.current) setSaving(false);
      }
    },
    [reload],
  );

  const add = useCallback(
    (title: string, startsAt: string) =>
      write('Not saved.', () => supabase.from('scheduled_shows').insert({ title, starts_at: startsAt }).select('id')),
    [supabase, write],
  );
  const update = useCallback(
    (id: string, patch: { title: string; starts_at: string }) =>
      write('Not saved.', () => supabase.from('scheduled_shows').update(patch).eq('id', id).select('id')),
    [supabase, write],
  );
  const remove = useCallback(
    (id: string) => write('Not deleted.', () => supabase.from('scheduled_shows').delete().eq('id', id).select('id')),
    [supabase, write],
  );

  // Fire-and-forget: marking a show aired must never get in the way of the broadcast going live.
  const markAired = useCallback(
    async (id: string) => {
      try {
        const { error: err } = (await supabase
          .from('scheduled_shows')
          .update({ aired_at: new Date().toISOString() })
          .eq('id', id)
          .is('aired_at', null)) as Rows;
        if (err) console.warn('[schedule] could not mark show aired', err.message);
        else void reload();
      } catch (e) {
        console.warn('[schedule] could not mark show aired', e);
      }
    },
    [supabase, reload],
  );

  useEffect(() => {
    alive.current = true;
    void reload();
    const resync = () => { if (!document.hidden) void reload(); };
    const timer = setInterval(resync, RESYNC_MS);
    document.addEventListener('visibilitychange', resync);
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', resync);
    };
  }, [reload]);

  return { shows, error, saving, reload, add, update, remove, markAired };
}
