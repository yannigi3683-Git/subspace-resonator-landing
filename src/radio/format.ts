// Format a duration in seconds as m:ss (e.g. 65 -> "1:05"). Negative/NaN clamp to 0:00.
export function formatClock(totalSeconds: number): string {
  const s = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
