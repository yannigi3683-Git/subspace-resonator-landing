import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Station } from '../types';

interface NowPlayingProps {
  station: Station | null;
  /** Current track name + whether it's in its peek window (15s/min). Optional: absent = title only. */
  nowPlaying?: { name: string; visible: boolean };
  /** Stage style: no NOW PLAYING label, pink neon pixel text in the DJ's slot. */
  neon?: boolean;
}

const DEFAULT_TITLE = 'Subspace Radio Live';

export function NowPlaying({ station, nowPlaying, neon = false }: NowPlayingProps) {
  const stationTitle = station?.live_title ?? null;
  const track = nowPlaying?.name?.trim() ? nowPlaying.name : null;
  // Banner subtitle: normally the station title; peeks the current track name for 15s/min.
  const shown = nowPlaying?.visible && track ? track : stationTitle;
  // The stage already has the station name in its title row, so the neon box says LIVE DJ instead
  // of repeating the default title. A custom show title (or a track) still shows.
  const text = neon && (!shown || shown.trim().toLowerCase() === DEFAULT_TITLE.toLowerCase()) ? 'LIVE DJ' : shown;
  // Lock-screen metadata prefers the live track name when known, else the station title.
  const mediaTitle = track ?? stationTitle;

  const clipRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowPx, setOverflowPx] = useState(0);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !mediaTitle) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: mediaTitle,
      artist: 'Subspace Resonator',
      album: 'Subspace Radio Live',
    });
  }, [mediaTitle]);

  // Marquee only when the text is wider than its box; otherwise it sits still (truncated).
  useLayoutEffect(() => {
    const clip = clipRef.current;
    const el = textRef.current;
    if (!clip || !el) return;
    const overflow = el.scrollWidth - clip.clientWidth;
    setOverflowPx(overflow > 8 ? overflow : 0);
  }, [text]);

  if (!text) {
    return <p className="font-mono text-[#555] text-xs tracking-wide">-</p>;
  }

  // Stage style: never scrolls. The box sits between the speakers, so a long title wraps (up to
  // two lines) instead of widening the box over them; beyond that it ellipsizes (the full
  // name stays in the tooltip and on the lock screen).
  if (neon) {
    // Short labels (LIVE DJ, OFF AIR) keep the pixel font. Long titles switch to the narrower display
    // face, because the pixel font is about 1em per character and fits barely 13 per line.
    const long = text.length > 12;
    return (
      <div
        className={`${long ? 'font-display font-bold text-[13px] md:text-[16px] leading-tight tracking-[0.02em] py-1.5' : 'pixel text-[12px] md:text-[14px] leading-[1.5] py-1.5'} text-[#FF5CCB] radio-neon text-center max-w-full px-3 rounded-md bg-black/80 border border-[#FF00AA]/40`}
        title={text}
      >
        {/* Glue a spaced dash to the next word so a wrapped line never starts with one. */}
        <span className="line-clamp-2 break-words text-balance">{text.replace(/ ([-|]) /g, ' $1 ')}</span>
      </div>
    );
  }

  const marquee = overflowPx > 0;
  // Constant-ish speed so long titles aren't dizzying; floor at 6s.
  const durationSec = Math.max(6, Math.round(4 + overflowPx / 25));
  const marqueeStyle = marquee
    ? ({ '--np-marquee': `${overflowPx}px`, '--np-marquee-dur': `${durationSec}s` } as CSSProperties)
    : undefined;

  return (
    <div
      className="font-mono text-white text-sm tracking-wide flex items-center min-w-0"
      title={text}
    >
      <span className="text-[#7B2FBE] text-xs mr-2 shrink-0">NOW PLAYING</span>
      <span ref={clipRef} className="flex-1 min-w-0 overflow-hidden">
        <span
          ref={textRef}
          className={marquee ? 'inline-block whitespace-nowrap radio-np-marquee' : 'block truncate'}
          style={marqueeStyle}
        >
          {text}
        </span>
      </span>
    </div>
  );
}
