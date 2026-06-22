interface PaStackProps {
  side: 'left' | 'right';
}

// Classic Turbosound Floodlight PA: a TFL-760H trapezoidal mid/high top sitting on a
// TSW-721 horn-loaded sub. The sub's signature is its near-square front split into four
// quadrants by a cross (a horn mouth, not a visible cone) on a wedge cabinet - that is
// what reads as "Floodlight" rather than a generic 18-inch box.
//
// STABILITY: purely static SVG. No props tied to playback, no state, no effects, no
// requestAnimationFrame, no AudioContext. It renders once and never updates, so it
// cannot touch the audio thread. The only motion is a CSS-only glow (radio-amp-glow,
// compositor-thread opacity/transform) behind the cabinet.
export function PaStack({ side }: PaStackProps) {
  return (
    <div className="relative w-full" aria-hidden="true">
      <div className="radio-amp-glow pointer-events-none absolute inset-[-14%]" />
      <svg viewBox="0 0 200 260" className="relative w-full h-auto" role="img" aria-label="Turbosound Floodlight speaker stack">
        <defs>
          <linearGradient id={`cab-${side}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#23262f" />
            <stop offset="100%" stopColor="#0d0e12" />
          </linearGradient>
          <pattern id={`grille-${side}`} width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="#000" opacity="0.55" />
          </pattern>
        </defs>

        {/* ── TOP: TFL-760H (trapezoid, sides splay wider toward the front) ── */}
        <polygon points="54,62 146,62 160,150 40,150" fill={`url(#cab-${side})`} stroke="#2c2f38" strokeWidth="1" />
        <line x1="54" y1="62" x2="146" y2="62" stroke="#26C6DA" strokeWidth="1" opacity="0.25" />
        <polygon points="58,67 142,67 154,145 46,145" fill="#0c0d11" stroke="#1c1e26" strokeWidth="0.6" />
        <polygon points="58,67 142,67 154,145 46,145" fill={`url(#grille-${side})`} opacity="0.5" />
        {/* faint 3-way driver hints behind the grille */}
        <circle cx="100" cy="94" r="16" fill="none" stroke="#000" strokeWidth="1" opacity="0.5" />
        <circle cx="100" cy="120" r="8" fill="none" stroke="#000" strokeWidth="0.8" opacity="0.45" />
        <circle cx="100" cy="136" r="2.5" fill="#000" opacity="0.5" />
        <ellipse cx="100" cy="141" rx="9" ry="2.5" fill="#15161b" stroke="#5a5f6b" strokeWidth="0.4" style={{ filter: 'drop-shadow(0 0 2px #FF2079)' }} />

        {/* ── SUB: TSW-721 (wedge cabinet, quadrant-cross horn mouth) ── */}
        <polygon points="20,156 180,156 172,150 28,150" fill="#16181e" stroke="#2c2f38" strokeWidth="0.8" />
        <line x1="28" y1="150" x2="172" y2="150" stroke="#26C6DA" strokeWidth="0.8" opacity="0.2" />
        <rect x="20" y="156" width="160" height="92" rx="2" fill={`url(#cab-${side})`} stroke="#2c2f38" strokeWidth="1" />
        {/* horn-mouth grille recess */}
        <rect x="28" y="162" width="144" height="74" rx="1" fill="#0c0d11" stroke="#1c1e26" strokeWidth="0.6" />
        <rect x="28" y="162" width="144" height="74" fill={`url(#grille-${side})`} opacity="0.5" />
        {/* the quadrant cross - the Floodlight signature */}
        <rect x="98.5" y="162" width="3" height="74" fill="#2a2d35" />
        <rect x="28" y="196" width="144" height="3" fill="#2a2d35" />
        {/* recessed side handles */}
        <rect x="21" y="178" width="6" height="22" rx="1.5" fill="#0a0b0e" stroke="#23252d" strokeWidth="0.5" />
        <rect x="173" y="178" width="6" height="22" rx="1.5" fill="#0a0b0e" stroke="#23252d" strokeWidth="0.5" />
        {/* logo */}
        <ellipse cx="100" cy="243" rx="10" ry="3" fill="#15161b" stroke="#5a5f6b" strokeWidth="0.4" style={{ filter: 'drop-shadow(0 0 2px #FF2079)' }} />
        {/* casters */}
        {[36, 80, 120, 164].map((cx) => (
          <g key={cx}>
            <rect x={cx - 1} y="244" width="2" height="4" fill="#23252d" />
            <circle cx={cx} cy="250" r="3.5" fill="#2a2d35" stroke="#15161b" strokeWidth="0.5" />
          </g>
        ))}
      </svg>
    </div>
  );
}
