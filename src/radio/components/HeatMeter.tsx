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
    <div className="flex flex-col items-center gap-2 px-3 py-3 border-b border-[#1a1a2e]" data-testid="heat-meter">
      <p className="font-mono text-[10px] tracking-[0.35em] text-white/60 uppercase">Heat Meter</p>

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
        <text x="18" y="114" className="font-mono" fontSize="9" fill="#26C6DA" letterSpacing="1">COOL</text>
        <text x="160" y="114" className="font-mono" fontSize="9" fill="#FF2079" letterSpacing="1">HOT</text>
      </svg>

      {/* Vote buttons */}
      <div className="flex items-center gap-2 w-full max-w-[220px]">
        <button
          type="button"
          onClick={() => vote(HEAT_COOL)}
          aria-pressed={myVote === HEAT_COOL}
          aria-label="Vote cool"
          className={[
            'flex-1 inline-flex items-center justify-center gap-1 min-h-[44px] rounded-lg border font-mono text-[11px] tracking-widest transition-colors',
            myVote === HEAT_COOL
              ? 'border-[#26C6DA] bg-[#26C6DA]/15 text-[#26C6DA]'
              : 'border-[#333] text-[#9fb6c2] hover:bg-[#26C6DA]/10',
          ].join(' ')}
        >
          <Snowflake className="w-4 h-4" aria-hidden="true" /> COOL
        </button>
        <button
          type="button"
          onClick={() => vote(HEAT_HOT)}
          aria-pressed={myVote === HEAT_HOT}
          aria-label="Vote hot"
          className={[
            'flex-1 inline-flex items-center justify-center gap-1 min-h-[44px] rounded-lg border font-mono text-[11px] tracking-widest transition-colors',
            myVote === HEAT_HOT
              ? 'border-[#FF2079] bg-[#FF2079]/15 text-[#FF2079]'
              : 'border-[#333] text-[#c2a0b0] hover:bg-[#FF2079]/10',
          ].join(' ')}
        >
          <Flame className="w-4 h-4" aria-hidden="true" /> HOT
        </button>
      </div>
    </div>
  );
}
