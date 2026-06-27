import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
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

// Strip everything outside printable ASCII. Pasting keys/URLs into a dashboard often
// drags along an invisible character (zero-width space, BOM, smart quote) above code
// point 255. Real Supabase keys/URLs are pure ASCII, so removing such chars recovers
// the intended value. A stray char in the apikey/Authorization header makes the browser
// reject the request with "String contains non ISO-8859-1 code point" at the fetch layer.
function toAscii(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 0x20 && code <= 0x7e) out += s[i];
  }
  return out.trim();
}

// Drop characters above ISO-8859-1 (code point 255) from header names/values, which the
// browser's fetch refuses to send. Defensive backstop for any header supabase-js builds.
function sanitizeHeaderValue(v: string): string {
  let out = '';
  for (let i = 0; i < v.length; i++) {
    if (v.charCodeAt(i) <= 0xff) out += v[i];
  }
  return out;
}

function makeSupabase() {
  const url = toAscii(import.meta.env.VITE_SUPABASE_URL as string);
  const key = toAscii(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
  if (!url || !key) return null;

  // supabase-js captures window.fetch at createClient() time, so module-level patches
  // applied later are too late. Pass a custom fetch here so supabase uses our sanitizing
  // wrapper from the start, for every auth/REST/realtime call.
  const cleanFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!init?.headers) return fetch(input, init);
    let h: Record<string, string>;
    if (init.headers instanceof Headers) {
      h = {};
      (init.headers as Headers).forEach((value, name) => { h[name] = value; });
    } else if (Array.isArray(init.headers)) {
      h = {};
      (init.headers as [string, string][]).forEach(([name, value]) => { h[name] = value; });
    } else {
      h = { ...(init.headers as Record<string, string>) };
    }
    const clean: Record<string, string> = {};
    for (const [name, value] of Object.entries(h)) {
      clean[sanitizeHeaderValue(name)] = sanitizeHeaderValue(value);
    }
    return fetch(input, { ...init, headers: clean });
  };

  return createClient(url, key, { global: { fetch: cleanFetch } });
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
      // Per-broadcast identity: a saved identity only carries over within the broadcast it was
      // picked for. A different (or first) live broadcast forces a fresh name/avatar pick.
      const liveId = station?.mode === 'live' ? station.live_session?.cfSessionId : undefined;
      const force = shouldForceReentry(liveId, getIdentitySession());
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

  // A new broadcast starting (cfSessionId changes) forces re-entry even if the viewer was already
  // in the room or sitting on standby. Keyed on the live broadcast id so the same broadcast never
  // re-prompts; only a host go-live after an end-broadcast does.
  const liveSessionId = station?.mode === 'live' ? station.live_session?.cfSessionId : undefined;
  useEffect(() => {
    if (view === 'banned' || view === 'loading') return;
    if (shouldForceReentry(liveSessionId, getIdentitySession())) {
      setIdentity(null);
      setView('gate');
    }
  }, [liveSessionId, view]);

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
          // Bind this pick to the current live broadcast so a close/reopen within the same
          // broadcast skips the gate; the next broadcast (new id) forces a fresh pick.
          if (liveSessionId) setIdentitySession(liveSessionId);
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
          <LiveRoom supabase={supabase} identity={identity} uid={uid} station={station} onIdentityChange={setIdentity} />
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
