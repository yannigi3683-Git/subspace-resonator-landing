// Pure helpers for the host's auto-mix crossfade. Kept side-effect free so the timing
// decision is unit-testable without the Web Audio graph.

export interface CrossfadeCheck {
  currentTime: number;
  duration: number;
  crossfadeSec: number;
  autoMix: boolean;
  hasNext: boolean;
  alreadyFading: boolean;
}

/**
 * True when the active track is close enough to its end to begin crossfading into the
 * next one: auto-mix is on, a next track exists, we are not already fading, the duration
 * is known, and the remaining time has fallen within the crossfade window.
 */
export function shouldStartCrossfade(c: CrossfadeCheck): boolean {
  if (!c.autoMix || !c.hasNext || c.alreadyFading) return false;
  if (!Number.isFinite(c.duration) || c.duration <= 0) return false;
  const remaining = c.duration - c.currentTime;
  return remaining > 0 && remaining <= c.crossfadeSec;
}

/** Clamp the crossfade length to the supported 1–12 second range (whole seconds). */
export function clampCrossfadeSec(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(12, Math.round(value)));
}
