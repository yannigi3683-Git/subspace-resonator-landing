import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import GoLivePanel from './GoLivePanel';

interface Props {
  supabase: SupabaseClient;
  authToken: () => string;
}

type Tab = 'broadcast' | 'schedule' | 'moderation';

export default function AdminConsole({ supabase, authToken }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('broadcast');
  const [listenerCount, setListenerCount] = useState(0);

  useEffect(() => {
    const channel = supabase
      .channel('admin-presence-count')
      .on('presence', { event: 'sync' }, () => {
        const count = Object.values(channel.presenceState()).flat().length;
        setListenerCount(count);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-8 max-w-2xl mx-auto">
      <p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground mb-2">
        // SUBSPACE RADIO LIVE
      </p>
      <h1 className="font-display text-2xl mb-6">HOST CONSOLE</h1>

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

      {activeTab === 'broadcast' && (
        <GoLivePanel supabase={supabase} authToken={authToken} listenerCount={listenerCount} />
      )}

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
