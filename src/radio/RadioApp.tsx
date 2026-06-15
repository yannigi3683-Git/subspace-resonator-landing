import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AdminGate from './admin/AdminGate';
import AdminConsole from './admin/AdminConsole';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RadioContext } from './RadioContext';
import { useStation } from './hooks/useStation';
import { useServerClock } from './hooks/useServerClock';
import { getOrCreateIdentity } from './identity';
import type { Identity } from './types';
import { EntryGate } from './components/EntryGate';
import { StandbyScreen } from './components/StandbyScreen';
import { LiveRoom } from './components/LiveRoom';

function makeSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  if (!url || !key) return null;
  return createClient(url, key);
}

const supabaseClient = makeSupabase();

function ListenerApp({ supabase }: { supabase: SupabaseClient }) {
  const [view, setView] = useState<'loading' | 'gate' | 'room' | 'banned'>('loading');
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const station = useStation(supabase);
  const getServerTime = useServerClock(supabase);

  useEffect(() => {
    if (localStorage.getItem('radio_banned') === '1') {
      setView('banned');
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      const storedIdentity = getOrCreateIdentity();
      if (session && storedIdentity) {
        setIdentity(storedIdentity);
        setUid(session.user.id);
        setView('room');
      } else {
        setView('gate');
      }
    });
  }, [supabase]);

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

  if (view === 'gate') {
    return (
      <EntryGate
        supabase={supabase}
        onEntry={(id, userId) => {
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
          <LiveRoom supabase={supabase} identity={identity} uid={uid} station={station} />
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
        authToken={() => ''}
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
