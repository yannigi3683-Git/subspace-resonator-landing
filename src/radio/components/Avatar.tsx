import type { ReactNode } from 'react';
import { getAvatar, AVATARS } from '../avatars';

interface AvatarProps {
  avatarId: string;
  size?: number;
  /** Accessible name (e.g. the listener's display name). Falls back to the avatar label. */
  label?: string;
  className?: string;
  glow?: boolean;
}

// One distinct "celestial entity" glyph per avatar, drawn in a 64x64 viewBox. Shapes use
// currentColor so the svg's `color` (set to the avatar's hex) drives every stroke/fill.
// Index follows the AVATARS order so each of the 12 avatars gets its own shape.
const SHAPES: ReactNode[] = [
  // nebula — drifting cloud rings
  (
    <g key="nebula" fill="none" stroke="currentColor" strokeWidth="3">
      <ellipse cx="32" cy="32" rx="20" ry="9" transform="rotate(20 32 32)" opacity="0.9" />
      <ellipse cx="32" cy="32" rx="13" ry="6" transform="rotate(-28 32 32)" opacity="0.6" />
      <circle cx="32" cy="32" r="4" fill="currentColor" stroke="none" />
    </g>
  ),
  // vortex — concentric rings
  (
    <g key="vortex" fill="none" stroke="currentColor" strokeWidth="3">
      <circle cx="32" cy="32" r="20" opacity="0.45" />
      <circle cx="32" cy="32" r="13" opacity="0.8" />
      <circle cx="32" cy="32" r="6" />
    </g>
  ),
  // fractal — nested triangles
  (
    <g key="fractal" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
      <polygon points="32,10 54,50 10,50" />
      <polygon points="32,46 21,27 43,27" opacity="0.75" />
    </g>
  ),
  // pulsar — radiating burst + core
  (
    <g key="pulsar" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="32" y1="6" x2="32" y2="20" />
      <line x1="32" y1="44" x2="32" y2="58" />
      <line x1="6" y1="32" x2="20" y2="32" />
      <line x1="44" y1="32" x2="58" y2="32" />
      <line x1="15" y1="15" x2="24" y2="24" opacity="0.7" />
      <line x1="40" y1="40" x2="49" y2="49" opacity="0.7" />
      <line x1="49" y1="15" x2="40" y2="24" opacity="0.7" />
      <line x1="24" y1="40" x2="15" y2="49" opacity="0.7" />
      <circle cx="32" cy="32" r="7" fill="currentColor" stroke="none" />
    </g>
  ),
  // wormhole — nested offset ellipses (tunnel)
  (
    <g key="wormhole" fill="none" stroke="currentColor" strokeWidth="3">
      <circle cx="32" cy="32" r="22" opacity="0.35" />
      <circle cx="30" cy="30" r="15" opacity="0.6" />
      <circle cx="28" cy="28" r="8" opacity="0.95" />
    </g>
  ),
  // quasar — core with vertical jets
  (
    <g key="quasar" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="32" y1="4" x2="32" y2="22" />
      <line x1="32" y1="42" x2="32" y2="60" />
      <ellipse cx="32" cy="32" rx="16" ry="6" fill="currentColor" stroke="none" opacity="0.5" />
      <circle cx="32" cy="32" r="6" fill="currentColor" stroke="none" />
    </g>
  ),
  // singularity — accretion ring + void core
  (
    <g key="singularity" stroke="currentColor" strokeWidth="3">
      <ellipse cx="32" cy="32" rx="22" ry="8" fill="none" opacity="0.7" />
      <circle cx="32" cy="32" r="9" fill="currentColor" stroke="none" />
      <circle cx="32" cy="32" r="4" fill="#05060f" stroke="none" />
    </g>
  ),
  // rift — fracture through a ring
  (
    <g key="rift" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      <circle cx="32" cy="32" r="20" opacity="0.35" />
      <polyline points="34,10 26,30 36,32 28,54" />
    </g>
  ),
  // cosmic — ringed planet
  (
    <g key="cosmic" stroke="currentColor" strokeWidth="3">
      <circle cx="32" cy="32" r="13" fill="currentColor" stroke="none" />
      <ellipse cx="32" cy="32" rx="24" ry="8" fill="none" transform="rotate(-20 32 32)" opacity="0.8" />
    </g>
  ),
  // zenith — ascending chevrons
  (
    <g key="zenith" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      <polyline points="12,40 32,18 52,40" />
      <polyline points="16,52 32,34 48,52" opacity="0.7" />
    </g>
  ),
  // eclipse — bright limb over a disc
  (
    <g key="eclipse" stroke="currentColor" strokeWidth="3">
      <circle cx="32" cy="32" r="18" fill="none" opacity="0.35" />
      <path d="M32 14 a18 18 0 0 1 0 36" fill="none" strokeWidth="4" />
      <circle cx="32" cy="32" r="6" fill="currentColor" stroke="none" />
    </g>
  ),
  // resonance — expanding sound waves
  (
    <g key="resonance" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <circle cx="32" cy="32" r="5" fill="currentColor" stroke="none" />
      <path d="M44 20 a17 17 0 0 1 0 24" opacity="0.8" />
      <path d="M50 14 a26 26 0 0 1 0 36" opacity="0.45" />
      <path d="M20 20 a17 17 0 0 0 0 24" opacity="0.8" />
      <path d="M14 14 a26 26 0 0 0 0 36" opacity="0.45" />
    </g>
  ),
];

export function Avatar({ avatarId, size = 32, label, className, glow = true }: AvatarProps) {
  const avatar = getAvatar(avatarId);
  const idx = Math.max(0, AVATARS.findIndex((a) => a.id === avatar.id));
  const name = label ?? avatar.label;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role="img"
      aria-label={name}
      data-variant={avatar.id}
      className={className}
      style={{
        color: avatar.color,
        filter: glow ? `drop-shadow(0 0 ${Math.max(3, Math.round(size / 6))}px ${avatar.color})` : undefined,
        overflow: 'visible',
      }}
    >
      <circle cx="32" cy="32" r="30" fill="currentColor" opacity="0.1" />
      {SHAPES[idx % SHAPES.length]}
    </svg>
  );
}
