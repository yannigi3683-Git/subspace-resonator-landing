import { useState, useEffect } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ScheduledShow {
  title: string;
  starts_at: string;
}

interface StandbyScreenProps {
  supabase: SupabaseClient;
  getServerTime: () => Date;
  onGoLive?: () => void;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'STARTING...';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function StandbyScreen({ supabase, getServerTime, onGoLive }: StandbyScreenProps) {
  const [nextShow, setNextShow] = useState<ScheduledShow | null>(null);
  const [countdown, setCountdown] = useState('');
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    supabase
      .from('scheduled_shows')
      .select('title, starts_at')
      .gt('starts_at', new Date().toISOString())
      .order('starts_at', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        setNextShow(data && data.length > 0 ? (data[0] as ScheduledShow) : null);
        setFetched(true);
      });
  }, [supabase]);

  useEffect(() => {
    if (!nextShow) return;
    const tick = () => {
      const ms = new Date(nextShow.starts_at).getTime() - getServerTime().getTime();
      setCountdown(formatCountdown(ms));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextShow, getServerTime]);

  void onGoLive;

  return (
    <div className="min-h-screen bg-[#0a0010] flex flex-col items-center justify-center p-6 text-center">
      <h1 className="font-mono text-white text-2xl font-bold tracking-widest mb-2">
        SUBSPACE RADIO LIVE
      </h1>
      <p className="font-mono text-[#888] text-sm tracking-widest mb-10">SIGNAL OFFLINE</p>

      {fetched && (
        <div className="mb-10">
          {nextShow ? (
            <>
              <p className="font-mono text-[#555] text-xs uppercase tracking-widest mb-2">
                Next transmission
              </p>
              <p
                className="font-mono text-white text-3xl font-bold tabular-nums mb-2"
                aria-live="polite"
                aria-label={`Countdown: ${countdown}`}
              >
                {countdown}
              </p>
              <p className="font-mono text-[#aaa] text-sm">{nextShow.title}</p>
            </>
          ) : (
            <p className="font-mono text-[#555] text-sm tracking-wide">
              NEXT TRANSMISSION: TBA
            </p>
          )}
        </div>
      )}

      <a
        href="/#archive"
        className="font-mono text-[#7B2FBE] text-sm hover:text-[#9B4FDE] underline tracking-wide"
      >
        Browse the archive
      </a>

      <p className="font-mono text-[#333] text-xs mt-10 tracking-wide">
        Subspace Radio - Goa / Psychedelic Trance
      </p>
    </div>
  );
}
