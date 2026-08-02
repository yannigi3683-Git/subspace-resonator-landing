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

  // A join or a leave must NOT disturb the people already on the floor. Re-seeding the whole
  // crowd on any roster change meant one arrival teleported all 200 back to their starting
  // layout, and in a busy room that happens faster than the simulation can spread them out - it
  // is why a crowd above ~50 looked permanently clumped. Newcomers are seeded, leavers dropped,
  // everyone else keeps their position. Only a geometry change (a resize) reseeds everybody,
  // where a jump is expected anyway.
  const roster = uids.join('|');
  const geometry = env ? `${env.region.x1}x${env.region.y1}:${env.radius}` : 'none';
  const signature = `${roster}::${geometry}`;
  const byUidRef = useRef(new Map<string, Agent>());
  const geometryRef = useRef('');
  const signatureRef = useRef('');
  if (env && signatureRef.current !== signature) {
    const carried = geometryRef.current === geometry ? byUidRef.current : new Map<string, Agent>();
    const newcomers = uids.filter((u) => !carried.has(u));
    const fresh = seedAgents(newcomers, env);
    const next = new Map<string, Agent>();
    newcomers.forEach((u, i) => next.set(u, fresh[i]));
    for (const u of uids) {
      const existing = carried.get(u);
      if (existing) next.set(u, existing);
    }
    byUidRef.current = next;
    // Index order must match the caller's node order, which is the order of `uids`.
    agentsRef.current = uids.map((u) => next.get(u)!);
    signatureRef.current = signature;
    geometryRef.current = geometry;
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
