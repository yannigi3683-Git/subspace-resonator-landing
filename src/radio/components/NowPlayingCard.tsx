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
        'border-2 border-[#8800FF] bg-[#220033] p-2 pr-4',
        'transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      ].join(' ')}
      style={{ boxShadow: '2px 2px 0 #FF00AA' }}
    >
      <div className="w-12 h-12 shrink-0 overflow-hidden border border-[#8800FF] bg-[#0A000F] flex items-center justify-center">
        {art ? (
          <img src={art} alt="" className="w-full h-full object-cover" />
        ) : (
          <Disc3 className="w-6 h-6 text-[#00FFEE]" aria-hidden="true" strokeWidth={1.5} />
        )}
      </div>
      <div className="min-w-0 flex flex-col">
        <span className="pixel text-[10px] text-[#00FFEE]">
          // NOW PLAYING
        </span>
        <span className="pixel text-[10px] text-white truncate" title={name}>
          {name}
        </span>
      </div>
    </div>
  );
}
