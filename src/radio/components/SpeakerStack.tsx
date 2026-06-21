import { useEffect, useRef, useState } from 'react';

interface SpeakerStackProps {
  side: 'left' | 'right';
  live: boolean;
}

// Classic Turbosound PA: one full-range top sitting on one sub, with a par-can
// floodlight washing the floor. Same visual vocabulary as the landing page's
// FloodlightSet (dark cabinet, HF horn, woofer cone + spokes + dust cap, brand
// strip) and the same faked 145 BPM kick groove. No AudioContext (matches PsyViz)
// so it is audio-safe for guests; the motion is driven by `live`.
export function SpeakerStack({ side, live }: SpeakerStackProps) {
  const [pulse, setPulse] = useState(0);
  const [hi, setHi] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!live) {
      setPulse(0);
      setHi(0);
      return;
    }
    const offset = side === 'right' ? 1.3 : 0;
    const animate = () => {
      const now = performance.now() / 1000;
      const bps = 145 / 60;
      const kickPhase = (now * bps) % 1;
      const kick = kickPhase < 0.12 ? Math.pow(1 - kickPhase / 0.12, 3) : 0;
      const sub = Math.pow(Math.max(0, Math.sin(now * Math.PI * 2 * (bps / 2) + offset)), 2) * 0.3;
      setPulse(kick + sub);
      const hiPhase = ((now * bps) + 0.5) % 1;
      setHi(hiPhase < 0.08 ? Math.pow(1 - hiPhase / 0.08, 4) : 0);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [live, side]);

  const accent = side === 'left' ? '#26C6DA' : '#FF2079';
  const dir = side === 'left' ? 1 : -1; // beam fans inward toward the floor centre
  const topCone = 0.7 * pulse;
  const subCone = pulse; // subs throw more cone excursion than the tops
  const beam = live ? 0.1 + hi * 0.25 + pulse * 0.18 : 0;

  // Par-can beam apex sits just above the can (60,14) and fans up + inward.
  const bx = 60 + dir * 80;
  const beamPath = `M60 14 L${bx} -60 L${60 + dir * 30} 36 Z`;

  const spokes = [0, 60, 120, 180, 240, 300];

  return (
    <svg
      viewBox="0 0 120 248"
      className="w-full h-auto"
      role="img"
      aria-label={`Turbosound speaker stack ${side}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`beam-${side}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={accent} stopOpacity="0.85" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`cab-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(220,20%,18%)" />
          <stop offset="100%" stopColor="hsl(220,18%,9%)" />
        </linearGradient>
        <radialGradient id={`topcone-${side}`} cx="45%" cy="40%">
          <stop offset="0%" stopColor={`hsl(0,0%,${26 + topCone * 18}%)`} />
          <stop offset="60%" stopColor={`hsl(0,0%,${14 + topCone * 8}%)`} />
          <stop offset="100%" stopColor="hsl(0,0%,7%)" />
        </radialGradient>
        <radialGradient id={`subcone-${side}`} cx="45%" cy="40%">
          <stop offset="0%" stopColor={`hsl(0,0%,${24 + subCone * 16}%)`} />
          <stop offset="60%" stopColor={`hsl(0,0%,${13 + subCone * 7}%)`} />
          <stop offset="100%" stopColor="hsl(0,0%,6%)" />
        </radialGradient>
      </defs>

      {/* Floodlight wash */}
      <path d={beamPath} fill={`url(#beam-${side})`} opacity={beam} style={{ transition: 'opacity 60ms linear' }} />

      {/* PAR can on a short pole above the stack */}
      <rect x="57" y="12" width="6" height="16" fill="hsl(220,12%,15%)" />
      <rect x="46" y="2" width="28" height="14" rx="2" fill="hsl(220,16%,13%)" stroke="hsl(220,15%,28%)" strokeWidth="1" />
      <ellipse
        cx="60"
        cy="9"
        rx="10"
        ry="5"
        fill={accent}
        opacity={0.3 + beam}
        style={{ filter: `drop-shadow(0 0 ${3 + beam * 9}px ${accent})` }}
      />

      {/* ── TOP CABINET (full-range "TF") ─────────────────────── */}
      <rect x="30" y="60" width="60" height="92" fill={`url(#cab-${side})`} stroke="hsl(220,15%,28%)" strokeWidth="1.5" />
      {/* HF horn */}
      <g>
        <rect x="36" y="66" width="48" height="26" fill="hsl(0,0%,6%)" stroke="hsl(0,0%,22%)" strokeWidth="1" />
        <path d="M50 70 L70 70 L78 88 L42 88 Z" fill={`hsl(0,0%,${10 + hi * 16}%)`} stroke="hsl(0,0%,26%)" strokeWidth="0.6" />
        <rect x="54" y="72" width="12" height="6" rx="0.8" fill={`hsl(0,0%,${14 + hi * 22}%)`} stroke="hsl(0,0%,28%)" strokeWidth="0.4" />
      </g>
      {/* woofer */}
      <g transform="translate(60,122)">
        <circle r="24" fill="hsl(0,0%,6%)" stroke="hsl(0,0%,22%)" strokeWidth="1" />
        <circle r="22" fill="none" stroke="hsl(0,0%,28%)" strokeWidth="0.8" />
        <g transform={`scale(${1 + topCone * 0.08})`}>
          <circle r="20" fill={`url(#topcone-${side})`} />
          {spokes.map((a) => (
            <line
              key={a}
              x1="0"
              y1="0"
              x2={19 * Math.cos((a * Math.PI) / 180)}
              y2={19 * Math.sin((a * Math.PI) / 180)}
              stroke="hsl(0,0%,18%)"
              strokeWidth="0.4"
            />
          ))}
        </g>
        <g transform={`scale(${1 + topCone * 0.18})`}>
          <circle r="6" fill={`hsl(0,0%,${18 + topCone * 16}%)`} stroke="hsl(0,0%,30%)" strokeWidth="0.6" />
        </g>
      </g>
      {/* brand strip */}
      <rect x="30" y="142" width="60" height="10" fill="hsl(220,18%,12%)" />
      <text x="60" y="149.5" textAnchor="middle" fontSize="6" letterSpacing="1.3" fill="hsl(0,0%,62%)" fontFamily="'Inter', sans-serif">
        TURBOSOUND
      </text>

      {/* ── SUB CABINET (wider, single 18") ───────────────────── */}
      <rect x="18" y="154" width="84" height="86" fill={`url(#cab-${side})`} stroke="hsl(220,15%,28%)" strokeWidth="1.5" />
      <g transform="translate(60,194)">
        <circle r="33" fill="hsl(0,0%,5%)" stroke="hsl(0,0%,20%)" strokeWidth="1.2" />
        <circle r="30" fill="none" stroke="hsl(0,0%,26%)" strokeWidth="1" />
        <g transform={`scale(${1 + subCone * 0.1})`}>
          <circle r="28" fill={`url(#subcone-${side})`} />
          {spokes.map((a) => (
            <line
              key={a}
              x1="0"
              y1="0"
              x2={26 * Math.cos((a * Math.PI) / 180)}
              y2={26 * Math.sin((a * Math.PI) / 180)}
              stroke="hsl(0,0%,16%)"
              strokeWidth="0.5"
            />
          ))}
        </g>
        <g transform={`scale(${1 + subCone * 0.22})`}>
          <circle r="9" fill={`hsl(0,0%,${16 + subCone * 18}%)`} stroke="hsl(0,0%,28%)" strokeWidth="0.8" />
        </g>
      </g>
      {/* bass-reflex ports */}
      <rect x="22" y="158" width="6" height="78" fill="hsl(0,0%,4%)" stroke="hsl(0,0%,18%)" strokeWidth="0.6" />
      <rect x="92" y="158" width="6" height="78" fill="hsl(0,0%,4%)" stroke="hsl(0,0%,18%)" strokeWidth="0.6" />
      <text x="60" y="236" textAnchor="middle" fontSize="6" letterSpacing="1" fill="hsl(0,0%,40%)" fontFamily="'Inter', sans-serif">
        {side === 'left' ? 'TSW-L' : 'TSW-R'}
      </text>
    </svg>
  );
}
