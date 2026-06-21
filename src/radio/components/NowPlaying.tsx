import { useEffect } from 'react';
import type { Station } from '../types';

interface NowPlayingProps {
  station: Station | null;
}

export function NowPlaying({ station }: NowPlayingProps) {
  const title = station?.live_title ?? null;

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !title) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: 'Subspace Resonator',
      album: 'Subspace Radio Live',
    });
  }, [title]);

  if (!title) {
    return <p className="font-mono text-[#555] text-xs tracking-wide">-</p>;
  }

  return (
    <div className="font-mono text-white text-sm tracking-wide truncate" title={title}>
      <span className="text-[#7B2FBE] text-xs mr-2">NOW PLAYING</span>
      {title}
    </div>
  );
}
