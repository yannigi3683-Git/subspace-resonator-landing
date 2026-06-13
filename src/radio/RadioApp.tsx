import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AdminGate from './admin/AdminGate';
import AdminConsole from './admin/AdminConsole';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  if (!url || !key) return null;
  return createClient(url, key);
}

const supabaseClient = makeSupabase();

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
