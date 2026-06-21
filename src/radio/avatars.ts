export interface AvatarDef {
  id: string;
  label: string;
  color: string;  // CSS hex color for the avatar circle
  textColor: string; // contrast text color
}

export const AVATARS: AvatarDef[] = [
  { id: 'nebula',      label: 'Nebula',      color: '#7B2FBE', textColor: '#fff' },
  { id: 'vortex',      label: 'Vortex',      color: '#00A8CC', textColor: '#fff' },
  { id: 'fractal',     label: 'Fractal',     color: '#FF6B35', textColor: '#fff' },
  { id: 'pulsar',      label: 'Pulsar',      color: '#39D353', textColor: '#000' },
  { id: 'wormhole',    label: 'Wormhole',    color: '#FF2079', textColor: '#fff' },
  { id: 'quasar',      label: 'Quasar',      color: '#FFD700', textColor: '#000' },
  { id: 'singularity', label: 'Singularity', color: '#E040FB', textColor: '#fff' },
  { id: 'rift',        label: 'Rift',        color: '#26C6DA', textColor: '#000' },
  { id: 'cosmic',      label: 'Cosmic',      color: '#FF7043', textColor: '#fff' },
  { id: 'zenith',      label: 'Zenith',      color: '#66BB6A', textColor: '#000' },
  { id: 'eclipse',     label: 'Eclipse',     color: '#AB47BC', textColor: '#fff' },
  { id: 'resonance',   label: 'Resonance',   color: '#42A5F5', textColor: '#fff' },
];

export const AVATAR_MAP = new Map<string, AvatarDef>(AVATARS.map(a => [a.id, a]));

export function getAvatar(id: string): AvatarDef {
  return AVATAR_MAP.get(id) ?? AVATARS[0];
}

export const DEFAULT_NAMES = [
  'NebulaDrifter', 'QuantumPulse', 'VortexRider', 'FractalMind',
  'PulsarBeam', 'WormholeTech', 'GalaxyWalker', 'CosmicWave',
  'SingularityX', 'RiftJumper', 'StarWeaver', 'ZenithSurfer',
  'EclipseMode', 'ResonanceFlow', 'AstralDrift', 'PsyVortex',
  'SubspaceGhost', 'NebulaRider', 'QuantumDrift', 'CryptoShaman',
];

export function randomDefaultName(): string {
  return DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)];
}

// A high-entropy suggestion: base name + a 3-digit suffix. With 20 bases x 900 suffixes,
// two listeners who both accept the suggestion practically never collide (the room runs
// pre-auth, so we can't read presence to pick an unused name; the suffix is the race-free way).
export function randomUniqueName(): string {
  const base = DEFAULT_NAMES[Math.floor(Math.random() * DEFAULT_NAMES.length)];
  const suffix = Math.floor(Math.random() * 900) + 100; // 100-999
  return `${base}${suffix}`;
}
