import { clampCrossfadeSec } from './rtc/crossfade';

// Host-chosen broadcast defaults, persisted so each new GO LIVE opens where the host left off.
export interface HostPrefs {
  /** Listener jitter buffer in seconds (0.3–5). */
  bufferSec: number;
  /** Auto-mix crossfade length in seconds (1–30). */
  crossfadeSec: number;
}

const KEY = 'radio_host_prefs';

export const DEFAULT_HOST_PREFS: HostPrefs = { bufferSec: 2.0, crossfadeSec: 12 };

function clampBufferSec(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HOST_PREFS.bufferSec;
  return Math.max(0.3, Math.min(5, value));
}

export function loadHostPrefs(): HostPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_HOST_PREFS };
    const parsed = JSON.parse(raw) as Partial<HostPrefs>;
    return {
      bufferSec: clampBufferSec(Number(parsed.bufferSec)),
      crossfadeSec: clampCrossfadeSec(Number(parsed.crossfadeSec)),
    };
  } catch {
    return { ...DEFAULT_HOST_PREFS };
  }
}

export function saveHostPrefs(prefs: HostPrefs): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        bufferSec: clampBufferSec(prefs.bufferSec),
        crossfadeSec: clampCrossfadeSec(prefs.crossfadeSec),
      }),
    );
  } catch {
    // Storage unavailable (private mode / quota) — defaults will be used next time.
  }
}
