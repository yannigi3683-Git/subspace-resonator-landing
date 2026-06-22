import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import GoLivePanel, { type BroadcastStatus } from './GoLivePanel';

interface Props {
  supabase: SupabaseClient;
  authToken: () => Promise<string>;
}

type Tab = 'broadcast' | 'schedule' | 'moderation';

export default function AdminConsole({ supabase, authToken }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('broadcast');
  const [listenerCount, setListenerCount] = useState(0);
  const [broadcastStatus, setBroadcastStatus] = useState<BroadcastStatus>('idle');

  useEffect(() => {
    // Count presence on the SAME channel listeners join (usePresence -> 'room:main').
    // The host only observes here (never track()s), so it isn't counted as a listener.
    const channel = supabase.channel('room:main', { config: { private: true } });
    const sync = () => {
      const count = Object.values(channel.presenceState()).flat().length;
      setListenerCount(count);
    };
    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

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
