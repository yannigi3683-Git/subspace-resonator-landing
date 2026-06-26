import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { Station } from '../types';

interface NowPlayingProps {
  station: Station | null;
  /** Current track name + whether it's in its peek window (15s/min). Optional: absent = title only. */
  nowPlaying?: { name: string; visible: boolean };
}

export function NowPlaying({ station, nowPlaying }: NowPlayingProps) {
  const stationTitle = station?.live_title ?? null;
  const track = nowPlaying?.name?.trim() ? nowPlaying.name : null;
  // Banner subtitle: normally the station title; peeks the current track name for 15s/min.
  const text = nowPlaying?.visible && track ? track : stationTitle;
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

  const marquee = overflowPx > 0;
  // Constant-ish speed so long titles aren't dizzying; floor at 6s.
  const durationSec = Math.max(6, Math.round(4 + overflowPx / 25));
  const marqueeStyle = marquee
    ? ({ '--np-marquee': `${overflowPx}px`, '--np-marquee-dur': `${durationSec}s` } as CSSProperties)
    : undefined;

  return (
    <div className="font-mono text-white text-sm tracking-wide flex items-center min-w-0" title={text}>
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
