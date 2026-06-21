import { Snowflake, Flame } from 'lucide-react';
import { heatToAngle, clamp01, HEAT_COOL, HEAT_HOT } from '../heatMeter';

interface HeatMeterProps {
  heat: number;
  myVote: number | null;
  vote: (value: number) => void;
}

// Glowing dots along the arc (cool -> hot), like the reference "bulbs" but spacey.
const DOTS = Array.from({ length: 9 }, (_, i) => {
  const t = i / 8;
  const angle = Math.PI - t * Math.PI; // 180deg (left) -> 0deg (right)
  return {
    t,
    x: 100 + 78 * Math.cos(angle),
    y: 100 - 78 * Math.sin(angle),
  };
});

// Interpolate cool-cyan -> purple -> hot-magenta across the arc.
function dotColor(t: number): string {
  if (t < 0.5) return mix('#26C6DA', '#7B2FBE', t / 0.5);
  return mix('#7B2FBE', '#FF2079', (t - 0.5) / 0.5);
}
function mix(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp01(t)));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export function HeatMeter({ heat, myVote, vote }: HeatMeterProps) {
  const h = clamp01(heat);
  const angle = heatToAngle(h);
  const litCount = Math.round(h * (DOTS.length - 1));

  return (
    <div className="flex flex-col items-center gap-2 px-3 py-3 border-b border-[#8800FF]" data-testid="heat-meter">
      <p className="pixel text-[10px] text-[#888899]">// HEAT METER</p>

      <svg viewBox="0 0 200 118" className="w-full max-w-[220px]" role="img" aria-label={`Crowd heat ${Math.round(h * 100)} percent`}>
        <defs>
          <linearGradient id="heatArc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#26C6DA" />
            <stop offset="50%" stopColor="#7B2FBE" />
            <stop offset="100%" stopColor="#FF2079" />
          </linearGradient>
        </defs>

        {/* Arc track */}
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#1a1a2e" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M20 100 A80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#heatArc)"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.85"
        />

        {/* Glowing dots */}
        {DOTS.map((d, i) => {
          const lit = i <= litCount;
          const color = dotColor(d.t);
          return (
            <circle
              key={i}
              cx={d.x}
              cy={d.y}
              r={lit ? 4 : 2.5}
              fill={lit ? color : '#2a2a40'}
              style={lit ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined}
            />
          );
        })}

        {/* Needle */}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '100px 100px', transition: 'transform 0.6s cubic-bezier(0.22,1,0.36,1)' }}>
          <line x1="100" y1="100" x2="100" y2="34" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="100" cy="34" r="3" fill="#ffffff" style={{ filter: 'drop-shadow(0 0 4px #fff)' }} />
        </g>
        <circle cx="100" cy="100" r="6" fill="#0a0010" stroke="#7B2FBE" strokeWidth="2" />

        {/* Labels */}
        <text x="16" y="114" fontFamily="'Press Start 2P', monospace" fontSize="8" fill="#00FFEE">COOL</text>
        <text x="155" y="114" fontFamily="'Press Start 2P', monospace" fontSize="8" fill="#FF00AA">HOT</text>
      </svg>

      {/* Vote buttons */}
      <div className="flex items-center gap-2 w-full max-w-[220px]">
        <button
          type="button"
          onClick={() => vote(HEAT_COOL)}
          aria-pressed={myVote === HEAT_COOL}
          aria-label="Vote cool"
          className={[
            'flex-1 inline-flex items-center justify-center gap-1 min-h-[44px] border-2 pixel text-[10px] transition-colors',
            myVote === HEAT_COOL
              ? 'border-[#00FFEE] bg-[#00FFEE]/20 text-[#00FFEE]'
              : 'border-[#8800FF] text-[#888899] hover:bg-[#00FFEE]/10',
          ].join(' ')}
          style={{ boxShadow: '2px 2px 0 #8800FF' }}
        >
          <Snowflake className="w-4 h-4" aria-hidden="true" /> COOL
        </button>
        <button
          type="button"
          onClick={() => vote(HEAT_HOT)}
          aria-pressed={myVote === HEAT_HOT}
          aria-label="Vote hot"
          className={[
            'flex-1 inline-flex items-center justify-center gap-1 min-h-[44px] border-2 pixel text-[10px] transition-colors',
            myVote === HEAT_HOT
              ? 'border-[#FF00AA] bg-[#FF00AA]/20 text-[#FF00AA]'
              : 'border-[#8800FF] text-[#888899] hover:bg-[#FF00AA]/10',
          ].join(' ')}
          style={{ boxShadow: '2px 2px 0 #8800FF' }}
        >
          <Flame className="w-4 h-4" aria-hidden="true" /> HOT
        </button>
      </div>
    </div>
  );
}
