import { useState, useEffect, useRef } from 'react';

// How long to allow for the deep buffer to come back on its own before telling the listener to
// reload. Measured on a real phone 2026-09-10: after a one minute outage the buffer was climbing
// within seconds of the network returning and was green well inside this window, so a genuine
// recovery always beats the timer.
export const STUCK_OFF_HLS_MS = 30_000;

/**
 * True when the listener HAD the deep buffer, lost it, and is still not back on it.
 *
 * Deliberately NOT keyed on "can they hear audio". Every proxy for that lied: `playing` reports
 * false while WebRTC is audible, `hlsReady` stays true after it stops being true. This asks a
 * question the app knows for certain instead: which transport is carrying playback.
 *
 * Why it matters rather than being cosmetic: WebRTC does not survive a phone screen lock, so a
 * listener pinned to it loses audio the moment their screen goes off. The deep buffer is what keeps
 * it alive.
 *
 * The timer only runs while the browser reports itself online. Telling someone to reload while
 * their connection is still down would hand them a blank page.
 */
export function useStuckOffDeepBuffer(
  onDeepBuffer: boolean,
  deepBufferOffered: boolean,
  ms: number = STUCK_OFF_HLS_MS,
): boolean {
  const hadItRef = useRef(false);
  const [stuck, setStuck] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    if (onDeepBuffer) {
      hadItRef.current = true;
      setStuck(false);
      return;
    }
    if (!hadItRef.current || !deepBufferOffered || !online) return;
    const timer = setTimeout(() => setStuck(true), ms);
    return () => clearTimeout(timer);
  }, [onDeepBuffer, deepBufferOffered, online, ms]);

  return stuck;
}
