import { useState, useEffect, useCallback } from 'react';

// How long the button stays in its CONNECTING state before offering the tap again. Reconnecting
// rebuilds the connection to Cloudflare, which takes a few seconds; this is generous enough to
// cover that, and short enough that a listener whose tap failed is not stuck looking at a dead
// button.
export const TAP_TIMEOUT_MS = 10_000;

/**
 * Immediate feedback for the audio tap.
 *
 * The tap starts a real reconnection, so there is a pause before sound returns. The button carried
 * on saying TAP TO LISTEN throughout, which reads as "nothing happened", so listeners jab at it.
 * Reported 2026-09-10: "a slight delay between the tap and the actual response that people will
 * lose patience with".
 *
 * This does not make the reconnection faster, and nothing here should try to: that is the frozen
 * audio path. It only stops the button lying about whether it heard you.
 */
export function useConnectingAfterTap(playing: boolean, ms: number = TAP_TIMEOUT_MS) {
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!connecting) return;
    if (playing) {
      setConnecting(false);
      return;
    }
    // Always give the button back. A tap can fail silently (autoplay refusal, a connection that
    // never comes up), and a permanently disabled button would leave the listener with no move.
    const timer = setTimeout(() => setConnecting(false), ms);
    return () => clearTimeout(timer);
  }, [connecting, playing, ms]);

  const markConnecting = useCallback(() => setConnecting(true), []);

  return [connecting, markConnecting] as const;
}
