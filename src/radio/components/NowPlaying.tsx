import { useEffect } from 'react';
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

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !mediaTitle) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: mediaTitle,
      artist: 'Subspace Resonator',
      album: 'Subspace Radio Live',
    });
  }, [mediaTitle]);

  if (!text) {
    return <p className="font-mono text-[#555] text-xs tracking-wide">-</p>;
  }

  return (
    <div className="font-mono text-white text-sm tracking-wide truncate" title={text}>
      <span className="text-[#7B2FBE] text-xs mr-2">NOW PLAYING</span>
      {text}
    </div>
  );
}
