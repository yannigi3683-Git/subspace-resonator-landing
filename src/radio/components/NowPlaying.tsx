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
    return <p className="pixel text-[10px] text-[#555]">-</p>;
  }

  return (
    <div className="pixel text-[10px] text-white truncate" title={title}>
      <span className="text-[#8800FF] mr-2">NOW PLAYING</span>
      {title}
    </div>
  );
}
