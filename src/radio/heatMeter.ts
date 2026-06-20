// Pure helpers for the crowd HEAT METER (cool 0 .. hot 1). Side-effect free for testing.

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

/** Average of all current votes; defaults to the neutral middle when nobody has voted. */
export function aggregateHeat(values: number[]): number {
  if (values.length === 0) return 0.5;
  const sum = values.reduce((a, b) => a + clamp01(b), 0);
  return clamp01(sum / values.length);
}

/** Needle rotation in degrees: heat 0 → -90° (points left/COOL), 1 → +90° (right/HOT). */
export function heatToAngle(heat: number): number {
  return -90 + clamp01(heat) * 180;
}

export const HEAT_COOL = 0;
export const HEAT_HOT = 1;
// Votes older than this are dropped so the meter reflects the live crowd, not history.
export const VOTE_TTL_MS = 30_000;
