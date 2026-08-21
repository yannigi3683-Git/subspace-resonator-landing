import { useState, useEffect } from 'react';
import AdminGate from './admin/AdminGate';
import AdminConsole from './admin/AdminConsole';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RadioContext } from './RadioContext';
import { useStation } from './hooks/useStation';
import { useServerClock } from './hooks/useServerClock';
import { getOrCreateIdentity, getIdentitySession, setIdentitySession, shouldForceReentry } from './identity';
import type { Identity } from './types';
import { EntryGate } from './components/EntryGate';
import { StandbyScreen } from './components/StandbyScreen';
import { LiveRoom } from './components/LiveRoom';
import { makeSupabase } from './supabaseClient';


const supabaseClient = makeSupabase();

function ListenerApp({ supabase }: { supabase: SupabaseClient }) {
  const [view, setView] = useState<'loading' | 'gate' | 'room' | 'banned' | 'kicked'>('loading');
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const station = useStation(supabase);
  const getServerTime = useServerClock(supabase);

  // The broadcast's identity, and the ONLY value allowed to drive re-entry. Keyed on startedAt,
  // NOT cfSessionId: a host network drop re-publishes and mints a new cfSessionId mid-show, which
  // used to kick everyone back to the gate. Only a host go-live after an end-broadcast changes
  // startedAt. Declared once and shared by both checks below plus the store on entry — when the
  // mount check and the store read different fields, every returning listener got re-gated.
  const broadcastId = station?.mode === 'live' ? station.live_session?.startedAt : undefined;

  useEffect(() => {
    if (localStorage.getItem('radio_banned') === '1') {
      setView('banned');
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      const storedIdentity = getOrCreateIdentity();
      // Per-broadcast identity: a saved identity only carries over within the broadcast it was
      // picked for. A different (or first) live broadcast forces a fresh name/avatar pick.
      const force = shouldForceReentry(broadcastId, getIdentitySession());
      if (session && storedIdentity && !force) {
        setIdentity(storedIdentity);
        setUid(session.user.id);
        setView('room');
      } else {
        setView('gate');
      }
    });
    // station intentionally excluded from deps: the live-transition is handled by the effect below;
    // this runs once on mount to decide the initial view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // A new broadcast starting forces re-entry even if the viewer was already in the room or
  // sitting on standby (broadcastId is declared above, shared with the mount check).
  useEffect(() => {
    if (view === 'banned' || view === 'loading') return;
    if (shouldForceReentry(broadcastId, getIdentitySession())) {
      setIdentity(null);
      setView('gate');
    }
  }, [broadcastId, view]);

  if (view === 'loading') {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="font-mono text-xs tracking-widest">LOADING...</p>
      </main>
    );
  }

  if (view === 'banned') {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <section className="section-border max-w-md w-full p-8 text-center">
          <p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground">
            // SUBSPACE RADIO LIVE
          </p>
          <h1 className="font-display text-3xl mt-4">SIGNAL BLOCKED</h1>
          <p className="font-mono text-xs mt-4 leading-relaxed text-muted-foreground">
            Your access to this transmission has been permanently revoked.
          </p>
        </section>
      </main>
    );
  }

  if (view === 'kicked') {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <section className="section-border max-w-md w-full p-8 text-center">
          <p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground">
            // SUBSPACE RADIO LIVE
          </p>
          <h1 className="font-display text-3xl mt-4">REMOVED FROM ROOM</h1>
          <p className="font-mono text-xs mt-4 leading-relaxed text-muted-foreground">
            You were removed by the host.
          </p>
        </section>
      </main>
    );
  }

  if (view === 'gate') {
    return (
      <EntryGate
        supabase={supabase}
        onEntry={(id, userId) => {
          // Bind this pick to the current live broadcast so a close/reopen within the same
          // broadcast skips the gate; the next broadcast (new id) forces a fresh pick.
          if (broadcastId) setIdentitySession(broadcastId);
          setIdentity(id);
          setUid(userId);
          setView('room');
        }}
      />
    );
  }

  if (view === 'room' && identity && uid) {
    return (
      <RadioContext.Provider value={{ supabase, identity, uid, station, getServerTime }}>
        {station === null ? (
          <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
            <p className="font-mono text-xs tracking-widest">LOADING...</p>
          </main>
        ) : station.mode === 'live' ? (
          <LiveRoom
            supabase={supabase}
            identity={identity}
            uid={uid}
            station={station}
            onIdentityChange={setIdentity}
            onRemoved={setView}
          />
        ) : (
          <StandbyScreen supabase={supabase} getServerTime={getServerTime} />
        )}
      </RadioContext.Provider>
    );
  }

  return null;
}

export default function RadioApp() {
  const [authedClient, setAuthedClient] = useState<SupabaseClient | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(window.location.hash === '#admin');
  }, []);

  if (isAdmin) {
    if (!supabaseClient) {
      return (
        <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
          <p className="font-mono text-xs text-destructive">
            Supabase env vars not configured. Check .env.
          </p>
        </main>
      );
    }

    if (!authedClient) {
      return (
        <AdminGate
          supabase={supabaseClient}
          onAuthenticated={(client) => setAuthedClient(client)}
        />
      );
    }

    return (
      <AdminConsole
        supabase={authedClient}
        authToken={async () => {
          const { data } = await authedClient!.auth.getSession();
          return data.session?.access_token ?? '';
        }}
      />
    );
  }

  if (!supabaseClient) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <section className="section-border max-w-md w-full p-8 text-center">
          <p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground">
            // SUBSPACE RADIO LIVE
          </p>
          <h1 className="font-display text-3xl mt-4">SIGNAL OFFLINE</h1>
          <p className="font-mono text-xs mt-4 leading-relaxed text-muted-foreground">
            The transmission system is being assembled. First broadcast coming soon.
          </p>
          <a
            href="/"
            className="inline-block mt-6 font-mono text-xs tracking-widest underline underline-offset-4 min-h-[44px] leading-[44px]"
          >
            RETURN TO MAIN SITE
          </a>
        </section>
      </main>
    );
  }

  return <ListenerApp supabase={supabaseClient} />;
}
