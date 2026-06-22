import { Disc3 } from 'lucide-react';

interface NowPlayingCardProps {
  name: string;
  art: string | null;
  visible: boolean;
}

// Listener-facing now-playing chip: cover art + track name. Visibility (always / peek / off)
// is decided by the host and computed in useNowPlaying; this component only animates in/out.
export function NowPlayingCard({ name, art, visible }: NowPlayingCardProps) {
  return (
    <div
      data-testid="now-playing-card"
      aria-hidden={!visible}
      className={[
        'absolute top-4 left-4 z-20 flex items-center gap-3 max-w-[min(20rem,calc(100%-2rem))]',
        'rounded-xl border border-white/10 bg-black/55 backdrop-blur-md p-2 pr-4',
        'transition-all duration-300 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none',
      ].join(' ')}
    >
      <div className="w-12 h-12 shrink-0 rounded-lg overflow-hidden bg-white/5 flex items-center justify-center">
        {art ? (
          <img src={art} alt="" className="w-full h-full object-cover" />
        ) : (
          <Disc3 className="w-6 h-6 text-[#26C6DA]" aria-hidden="true" strokeWidth={1.5} />
        )}
      </div>
      <div className="min-w-0 flex flex-col">
        <span className="font-mono text-[10px] tracking-[0.3em] text-[#26C6DA] uppercase">
          Now Playing
        </span>
        <span className="font-mono text-sm text-white truncate" title={name}>
          {name}
        </span>
      </div>
    </div>
  );
}
