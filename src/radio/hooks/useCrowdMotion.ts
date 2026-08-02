import { useEffect, useRef } from 'react';
import { seedAgents, stepAgents, type Agent, type CrowdEnv } from '../crowdMotion';

const TICK_MS = 1000 / 30;

/**
 * Runs the crowd simulation and writes each avatar's position straight to its DOM node.
 *
 * Positions deliberately never enter React state: at 30fps with up to 200 avatars that would be
 * thousands of re-renders a second on the same thread the radio room runs on. The hook owns an
 * array of refs instead and mutates `style.transform`.
 *
 * The loop does not run at all when the crowd is empty, when the tab is hidden, or when the
 * viewer has asked for reduced motion.
 */
export function useCrowdMotion(uids: string[], env: CrowdEnv | null, enabled: boolean) {
  const nodesRef = useRef<(HTMLElement | null)[]>([]);
  const agentsRef = useRef<Agent[]>([]);
  const envRef = useRef<CrowdEnv | null>(env);
  envRef.current = env;

  // Re-seed only when the roster or the floor actually changes, not on every render: reseeding
  // teleports everybody back to their starting positions.
  const signature = `${uids.join('|')}::${env ? `${env.region.x1}x${env.region.y1}:${env.radius}` : 'none'}`;
  const signatureRef = useRef('');
  if (env && signatureRef.current !== signature) {
    signatureRef.current = signature;
    agentsRef.current = seedAgents(uids, env);
  }

  useEffect(() => {
    if (!enabled || !env || uids.length === 0) return;
    if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const paint = () => {
      const nodes = nodesRef.current;
      const agents = agentsRef.current;
      for (let i = 0; i < agents.length; i++) {
        const node = nodes[i];
        if (node) {
          node.style.transform = `translate3d(${agents[i].x}px, ${agents[i].y}px, 0) translate(-50%, -50%)`;
        }
      }
    };

    paint();
    if (reduced) return; // Placed, but never animated.

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = now - last;
      last = now;
      if (document.hidden) return;
      acc += dt;
      if (acc < TICK_MS) return;
      const current = envRef.current;
      if (current) stepAgents(agentsRef.current, current, acc);
      acc = 0;
      paint();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [enabled, signature, uids.length, env]);

  return nodesRef;
}
