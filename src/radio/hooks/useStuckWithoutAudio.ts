import { useState, useEffect, useRef } from 'react';

// How long the audio overlay may sit there before we stop telling the listener to tap.
// A HOST reconnect recovers on its own within a few seconds (cfSessionId changes, the audio effect
// re-runs), so anything still stuck well past that is the LISTENER's own connection, which a tap
// cannot fix. Confirmed on a real phone 2026-09-10: airplane mode on the listener leaves the tap
// dead and only a page reload recovers.
export const STUCK_MS = 15_000;

/**
 * True once audio has played, then stopped, and has stayed stopped for `ms`.
 *
 * The "has played" part is what keeps a first-time visitor out of it: on arrival nothing has played
 * yet because they have not tapped, and telling them to reload a page they just opened would be
 * nonsense. Only someone who WAS listening and lost it can become stuck.
 */
export function useStuckWithoutAudio(playing: boolean, ms: number = STUCK_MS): boolean {
  const hasPlayedRef = useRef(false);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    if (playing) {
      hasPlayedRef.current = true;
      setStuck(false);
      return;
    }
    if (!hasPlayedRef.current) return;
    const timer = setTimeout(() => setStuck(true), ms);
    return () => clearTimeout(timer);
  }, [playing, ms]);

  return stuck;
}
