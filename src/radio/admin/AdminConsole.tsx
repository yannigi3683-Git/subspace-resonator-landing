import { useState, useEffect, useRef } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import GoLivePanel, { type BroadcastStatus } from './GoLivePanel';
import { dedupeByDevice } from '../hooks/usePresence';
import { makeSupabase } from '../supabaseClient';
import type { PresenceEntry } from '../types';

const OBSERVER_REBUILD_MS = 60_000;

interface Props {
  supabase: SupabaseClient;
  authToken: () => Promise<string>;
}

type Tab = 'broadcast' | 'schedule' | 'moderation';

export default function AdminConsole({ supabase, authToken }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('broadcast');
  const [listenerCount, setListenerCount] = useState(0);
  const [broadcastStatus, setBroadcastStatus] = useState<BroadcastStatus>('idle');

  const authTokenRef = useRef(authToken);
  authTokenRef.current = authToken;

  useEffect(() => {
    // Count presence on the SAME channel listeners join (usePresence -> 'room:main').
    // The host only observes here (never track()s), so it isn't counted as a listener.
    //
    // ponytail: rebuild every 60s on a DEDICATED client. This observer never reconnects on a
    // healthy show, so it never receives a second presence_state — the only thing that prunes a
    // stale entry — and the map freezes for the rest of the broadcast. Measured 2026-08-21: the
    // console read 7+ while the server held 3 and the guest room held 3. The rebuild also re-auths
    // before the admin JWT ages out, which is what drops the private channel in the first place.
    // Its own client so a rebuild cannot touch the socket carrying room:control / room:nowplaying
    // to listeners. Narrow to a status-driven rebuild only if the 60s rejoin ever costs something
    // measurable.
    //
    // persistSession/autoRefreshToken off, and its own storageKey: two GoTrue clients sharing the
    // default key on one origin both refresh the same session and can knock the host out of the
    // console. This client is fed tokens by hand and must never touch auth storage.
    const observer = makeSupabase({
      persistSession: false,
      autoRefreshToken: false,
      storageKey: 'sb-radio-presence-observer',
    });
    if (!observer) return;

    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const sync = (ch: RealtimeChannel) => {
      // Dedupe by deviceId the same way listeners do (usePresence -> dedupeByDevice), so the
      // host count matches the room. Without this, same-device ghosts (anon re-auth mints a new
      // uid, rename re-subscribe, extra tabs) inflate the host number over long broadcasts.
      const state = ch.presenceState<{ uid: string; name: string; avatarId: string; deviceId?: string; position: { x: number; y: number } }>();
      const list: PresenceEntry[] = Object.values(state).flat().map((p) => ({
        uid: p.uid,
        name: p.name,
        avatarId: p.avatarId,
        deviceId: p.deviceId,
        position: p.position,
      }));
      setListenerCount(dedupeByDevice(list).length);
    };

    // Never clears listenerCount: the replacement's first presence_state lands ~200ms after the
    // teardown, and a flash of 0 would fire the badge's key-change animation every minute.
    const build = async () => {
      try {
        await observer.realtime.setAuth(await authTokenRef.current());
      } catch {
        return; // next rebuild retries; the last known count stays on screen
      }
      if (cancelled) return;
      const ch = observer.channel('room:main', { config: { private: true } });
      channel = ch;
      ch
        .on('presence', { event: 'sync' }, () => sync(ch))
        .on('presence', { event: 'join' }, () => sync(ch))
        .on('presence', { event: 'leave' }, () => sync(ch))
        // Logged, not swallowed: a silently dropped channel is exactly how the count froze.
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') console.warn('[radio] presence observer:', status);
        });
    };

    void build();

    // Remove THEN create: supabase-js `channel(topic)` returns the existing channel for a matching
    // topic, so building the replacement first would just hand back the stale one.
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

  // Truthful live indicator: only 'live' means audio is actually going out.
  // 'starting'/'ending' are transitional; 'idle'/'error' are off the air.
  const onAir = broadcastStatus === 'live';
  const transitioning = broadcastStatus === 'starting' || broadcastStatus === 'ending';

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-8 max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground mb-2">
            // SUBSPACE RADIO LIVE
          </p>
          <h1 className="font-display text-2xl">HOST CONSOLE</h1>
        </div>

        {/* Persistent ON AIR / OFF AIR badge — visible on every tab so the host always
            knows whether audio is going out, and can jump back to stop it. */}
        <button
          type="button"
          onClick={() => setActiveTab('broadcast')}
          data-testid="broadcast-status-badge"
          aria-live="polite"
          className={[
            'font-mono text-[11px] tracking-widest px-3 min-h-[44px] border transition-colors shrink-0',
            onAir
              ? 'border-red-500 text-red-400 hover:bg-red-500/10'
              : transitioning
                ? 'border-amber-500 text-amber-400 hover:bg-amber-500/10'
                : 'border-border text-muted-foreground hover:bg-primary/10',
          ].join(' ')}
        >
          {onAir ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
              ON AIR
            </span>
          ) : transitioning ? (
            broadcastStatus === 'starting' ? 'CONNECTING…' : 'ENDING…'
          ) : (
            'OFF AIR'
          )}
        </button>
      </div>

      {/* Tab bar */}
      <nav className="flex gap-0 mb-6 border border-border w-fit">
        {(['broadcast', 'schedule', 'moderation'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'font-mono text-[11px] tracking-widest px-5 min-h-[44px] transition-colors',
              activeTab === tab
                ? 'bg-primary/20 text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-primary/10',
            ].join(' ')}
            aria-current={activeTab === tab ? 'page' : undefined}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* GoLivePanel stays MOUNTED across tab changes — unmounting it would silently
          orphan a live RTCPeerConnection/AudioContext (audio keeps streaming) while the
          remounted panel resets to GO LIVE, lying about the broadcast state. */}
      <div className={activeTab === 'broadcast' ? '' : 'hidden'}>
        <GoLivePanel
          supabase={supabase}
          authToken={authToken}
          listenerCount={listenerCount}
          onStatusChange={setBroadcastStatus}
        />
      </div>

      {activeTab === 'schedule' && (
        <section className="section-border p-6">
          <p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground mb-4">
            // SCHEDULE
          </p>
          <p className="font-mono text-xs text-muted-foreground">Scheduled shows - coming in M8.</p>
        </section>
      )}

      {activeTab === 'moderation' && (
        <section className="section-border p-6">
          <p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground mb-4">
            // MODERATION
          </p>
          <p className="font-mono text-xs text-muted-foreground">Kick / ban controls - coming in M8.</p>
        </section>
      )}
    </main>
  );
}
