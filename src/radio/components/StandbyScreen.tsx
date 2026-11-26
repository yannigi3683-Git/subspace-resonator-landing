import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatCountdown, formatShowTime, standbyState, type Show } from '../scheduleRules';

interface StandbyScreenProps {
  supabase: SupabaseClient;
  getServerTime: () => Date;
  zone?: string;
  locale?: string;
}

const RESYNC_MS = 60_000;

function guestZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function shortTime(isoString: string, zone: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: zone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return '';
  }
}

function Countdown({ ms }: { ms: number }) {
  const text = formatCountdown(ms);
  const days = /^(\d+)d (.*)$/.exec(text);
  return (
    <p data-testid="countdown" className="font-mono text-white text-4xl [@media(max-height:500px)]:text-3xl tabular-nums tracking-tight mb-4"
      style={{ textShadow: '0 0 18px rgba(123,47,190,0.6)' }}>
      {days ? <>{days[1]}<span className="text-2xl text-white/60">d</span> {days[2]}</> : text}
    </p>
  );
}

// Off-air screen. The server decides which shows count as upcoming (upcoming_shows uses now()),
// so a phone with a wrong clock cannot hide or resurrect one; the countdown ticks against the
// server clock. A failed read shows no card rather than a false "TBA".
export function StandbyScreen({ supabase, getServerTime, zone, locale }: StandbyScreenProps) {
  const tz = zone ?? guestZone();
  const lang = locale ?? (typeof navigator !== 'undefined' ? navigator.language : 'en-GB');
  const [shows, setShows] = useState<Show[] | null>([]);
  const [loaded, setLoaded] = useState(false);
  const [, setTick] = useState(0);
  // After one good read, a failed refresh keeps the last good list: on a weak phone signal the
  // countdown must not vanish for a minute. Only a page that never read successfully says nothing.
  const okOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const read = async () => {
      try {
        const { data, error } = await supabase.rpc('upcoming_shows', { _limit: 3 });
        if (cancelled) return;
        if (error || !Array.isArray(data)) {
          if (!okOnce.current) setShows(null);
        } else {
          okOnce.current = true;
          setShows(data as Show[]);
        }
      } catch {
        if (!cancelled && !okOnce.current) setShows(null);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void read();
    const resync = () => { if (!document.hidden) void read(); };
    const timer = setInterval(resync, RESYNC_MS);
    document.addEventListener('visibilitychange', resync);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', resync);
    };
  }, [supabase]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = getServerTime().getTime();
  const state = standbyState(shows, now);
  const soon = state.kind === 'starting-soon';

  const when = state.next ? formatShowTime(state.next.starts_at, tz, lang) : '';
  const cut = when.lastIndexOf(', ');
  const [datePart, timePart] = cut > 0 ? [when.slice(0, cut), when.slice(cut + 2)] : ['', when];

  return (
    <div className="min-h-[100dvh] bg-[#05060f] radio-nebula relative overflow-x-hidden flex flex-col items-center justify-center px-6 py-10 [@media(max-height:500px)]:py-6 text-center">
      <div className="absolute inset-0 radio-stars pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-1/3 radio-aurora pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[30%] radio-floor-glow pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        <h1 className="font-display text-white text-2xl sm:text-3xl font-bold tracking-[0.2em] mb-2"
          style={{ textShadow: '0 0 24px rgba(38,198,218,0.5)' }}>
          SUBSPACE RADIO
        </h1>
        <p aria-live="polite"
          className={`font-mono text-xs tracking-widest mb-10 [@media(max-height:500px)]:mb-4 inline-flex items-center gap-2 ${soon ? 'text-[#26C6DA]' : 'text-white/60'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${soon ? 'bg-[#26C6DA]' : 'bg-white/50'}`} aria-hidden="true" />
          {soon ? 'STANDING BY' : 'SIGNAL OFFLINE'}
        </p>

        {loaded && state.kind === 'countdown' && (
          <div className="w-full border border-white/10 bg-white/[0.04] backdrop-blur px-5 py-6">
            <p className="font-mono text-[#26C6DA]/80 text-[10px] tracking-[0.3em] mb-3">NEXT TRANSMISSION</p>
            <Countdown ms={Date.parse(state.next.starts_at) - now} />
            <p className="font-display text-white text-lg tracking-wide mb-1 uppercase break-words">{state.next.title}</p>
            <p data-testid="show-when" className="font-mono text-white/70 text-xs">
              {datePart && <>{datePart}, </>}
              <span className="whitespace-nowrap">{timePart} <span className="text-white/60">· your time</span></span>
            </p>
          </div>
        )}

        {loaded && soon && state.next && (
          <div className="w-full border border-[#26C6DA]/40 bg-[#26C6DA]/[0.06] backdrop-blur px-5 py-6">
            <p className="font-mono text-[#26C6DA] text-[10px] tracking-[0.3em] mb-3 inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#26C6DA] radio-soon-pulse" style={{ boxShadow: '0 0 10px #26C6DA' }} aria-hidden="true" />
              STARTING SOON
            </p>
            <p className="font-display text-white text-lg tracking-wide mb-1 uppercase break-words">{state.next.title}</p>
            <p className="font-mono text-white/70 text-xs">Scheduled for {timePart}</p>
            <p className="font-mono text-white/60 text-[11px] mt-3 leading-relaxed">Due any minute.</p>
          </div>
        )}

        {loaded && state.kind === 'tba' && (
          <div className="w-full border border-white/10 bg-white/[0.04] backdrop-blur px-5 py-6">
            <p className="font-mono text-[#26C6DA]/80 text-[10px] tracking-[0.3em] mb-3">NEXT TRANSMISSION</p>
            <p className="font-display text-white text-2xl tracking-[0.2em]">TBA</p>
          </div>
        )}

        {state.later.length > 0 && (
          <div data-testid="later" className="w-full mt-8 [@media(max-height:500px)]:mt-4 text-left">
            <p id="standby-later" className="font-mono text-[#26C6DA]/80 text-[10px] tracking-[0.3em] mb-2">LATER</p>
            <ul aria-labelledby="standby-later">
              {state.later.map((s) => (
                <li key={s.id} className="flex items-baseline justify-between gap-3 py-2 border-t border-white/10">
                  <span className="font-mono text-white/80 text-xs min-w-0 line-clamp-2 break-words">{s.title}</span>
                  <span className="font-mono text-white/60 text-[11px] tabular-nums shrink-0">{shortTime(s.starts_at, tz, lang)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(state.next || state.kind === 'unavailable') && (
          <p className="font-mono text-white/60 text-[11px] leading-relaxed mt-8 [@media(max-height:500px)]:mt-4 max-w-[260px]">
            Keep this page open. It switches over by itself when the signal goes live.
          </p>
        )}

        <a href="/#archive"
          className="font-mono text-[#B388F0] text-sm underline underline-offset-4 tracking-wide min-h-[44px] inline-flex items-center mt-8 [@media(max-height:500px)]:mt-4">
          Browse the archive
        </a>
        <p className="font-mono text-white/55 text-[10px] mt-6 [@media(max-height:500px)]:mt-2 tracking-wide">
          Subspace Radio · Goa / Psychedelic Trance
        </p>
      </div>
    </div>
  );
}
