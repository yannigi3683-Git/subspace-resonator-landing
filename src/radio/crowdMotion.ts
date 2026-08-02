/**
 * Crowd steering: avatars wander the whole floor, push apart when they get too close, and are
 * pushed out of fixed props.
 *
 * This replaced two earlier models. A grid of fixed cells read as a formation. Private
 * territories guaranteed no crossings but caged everybody in their own patch, which is not what
 * a crowd looks like. Neither could give free movement AND avoidance, because avoidance needs
 * each avatar to know where the others are, and that means simulating.
 *
 * COST, deliberately taken: this is JavaScript per frame on the same thread as the radio room.
 * It is kept cheap on purpose - a spatial hash so neighbour lookups are O(n) rather than O(n^2),
 * a 30fps tick rather than 60, positions written straight to the DOM so React never re-renders,
 * and the loop stops entirely when the tab is hidden or the crowd is empty.
 */

export interface Agent {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Current wander destination. */
  tx: number;
  ty: number;
  seed: number;
}

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface Circle { cx: number; cy: number; r: number }
export interface Region { x0: number; y0: number; x1: number; y1: number }

export interface CrowdEnv {
  region: Region;
  viz: Circle;
  rects: Rect[];
  /** Half the rendered avatar, so props and neighbours are cleared by the body not the centre. */
  radius: number;
  /** Pixels per second. A dance floor drift, not a commute. */
  speed: number;
}

// Neighbours closer than this many radii push apart. Above 2 they would never touch at all;
// slightly below lets them brush and briefly overlap, which is what the owner asked for.
const SEPARATION_RADII = 1.7;
// How hard the push is, relative to the overlap. Soft, so contact reads as a nudge not a bounce.
const SEPARATION_FORCE = 6;
const OBSTACLE_FORCE = 30;
const ARRIVE_PX = 14;
const MAX_STEP_MS = 100;

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0xffffffff;
  };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Whether a point (with the avatar's body) is clear of every fixed prop. */
export function isClear(x: number, y: number, env: CrowdEnv): boolean {
  if (Math.hypot(x - env.viz.cx, y - env.viz.cy) < env.viz.r + env.radius) return false;
  return !env.rects.some((r) =>
    x > r.x0 - env.radius && x < r.x1 + env.radius && y > r.y0 - env.radius && y < r.y1 + env.radius);
}

/**
 * Push an agent out of anything it has ended up inside.
 *
 * The steering forces are a nudge and can be overpowered - a tight pocket of neighbours pushing
 * one way sums to more than one obstacle pushing the other. This runs after integration and is a
 * hard constraint, so "never inside a prop" holds regardless of how the forces balanced.
 */
function resolveObstacles(a: Agent, env: CrowdEnv): void {
  for (let pass = 0; pass < 2; pass++) {
    const dx = a.x - env.viz.cx;
    const dy = a.y - env.viz.cy;
    const d = Math.hypot(dx, dy);
    const minV = env.viz.r + env.radius;
    if (d < minV) {
      const nx = d > 0.001 ? dx / d : 1;
      const ny = d > 0.001 ? dy / d : 0;
      a.x = env.viz.cx + nx * minV;
      a.y = env.viz.cy + ny * minV;
    }
    for (const r of env.rects) {
      const x0 = r.x0 - env.radius;
      const x1 = r.x1 + env.radius;
      const y0 = r.y0 - env.radius;
      const y1 = r.y1 + env.radius;
      if (a.x <= x0 || a.x >= x1 || a.y <= y0 || a.y >= y1) continue;
      const options: [number, number, number][] = [
        [a.x - x0, x0, a.y], [x1 - a.x, x1, a.y],
      ];
      const vertical: [number, number, number][] = [
        [a.y - y0, a.x, y0], [y1 - a.y, a.x, y1],
      ];
      const all = [...options, ...vertical].filter(([, nx, ny]) =>
        nx >= env.region.x0 && nx <= env.region.x1 && ny >= env.region.y0 && ny <= env.region.y1);
      if (all.length === 0) continue;
      const [, nx, ny] = all.reduce((best, cur) => (cur[0] < best[0] ? cur : best));
      a.x = nx;
      a.y = ny;
    }
    a.x = clamp(a.x, env.region.x0, env.region.x1);
    a.y = clamp(a.y, env.region.y0, env.region.y1);
  }
}

function pickTarget(agent: Agent, env: CrowdEnv) {
  const next = rng(agent.seed + Math.floor(agent.x) * 31 + Math.floor(agent.y));
  const { region } = env;
  for (let i = 0; i < 24; i++) {
    const x = region.x0 + next() * (region.x1 - region.x0);
    const y = region.y0 + next() * (region.y1 - region.y0);
    if (isClear(x, y, env)) {
      agent.tx = x;
      agent.ty = y;
      agent.seed = (agent.seed * 1103515245 + 12345) >>> 0;
      return;
    }
  }
  agent.tx = agent.x;
  agent.ty = agent.y;
}

/**
 * Deterministic starting positions, so a reload does not reshuffle the room before the
 * simulation has taken over. Seeded per listener, spread over the clear floor.
 */
export function seedAgents(uids: string[], env: CrowdEnv): Agent[] {
  return uids.map((uid, i) => {
    let h = 5381;
    for (let k = 0; k < uid.length; k++) h = ((h << 5) + h + uid.charCodeAt(k)) >>> 0;
    const next = rng(h);
    const { region } = env;
    let x = 0;
    let y = 0;
    for (let attempt = 0; attempt < 30; attempt++) {
      x = region.x0 + next() * (region.x1 - region.x0);
      y = region.y0 + next() * (region.y1 - region.y0);
      if (isClear(x, y, env)) break;
    }
    const agent: Agent = { x, y, vx: 0, vy: 0, tx: x, ty: y, seed: h + i };
    pickTarget(agent, env);
    return agent;
  });
}

/**
 * Advance the crowd by dtMs. Mutates in place - this runs every frame, so it does not allocate
 * a new array each tick.
 */
export function stepAgents(agents: Agent[], env: CrowdEnv, dtMs: number): void {
  const dt = Math.min(dtMs, MAX_STEP_MS) / 1000;
  if (dt <= 0 || agents.length === 0) return;

  const sepDist = env.radius * SEPARATION_RADII * 2;
  // Spatial hash keyed on the separation distance: only same or adjacent buckets can be within
  // range, which is what keeps this O(n) instead of every-pair.
  const cell = Math.max(1, sepDist);
  const buckets = new Map<number, number[]>();
  const key = (cx: number, cy: number) => cx * 73856093 ^ cy * 19349663;
  for (let i = 0; i < agents.length; i++) {
    const k = key(Math.floor(agents[i].x / cell), Math.floor(agents[i].y / cell));
    const list = buckets.get(k);
    if (list) list.push(i); else buckets.set(k, [i]);
  }

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i];
    let fx = 0;
    let fy = 0;

    // Wander: head for the current target, pick a new one on arrival.
    const dxt = a.tx - a.x;
    const dyt = a.ty - a.y;
    const distT = Math.hypot(dxt, dyt);
    if (distT < ARRIVE_PX) pickTarget(a, env);
    else { fx += (dxt / distT) * env.speed; fy += (dyt / distT) * env.speed; }

    // Separation from near neighbours only.
    const gx = Math.floor(a.x / cell);
    const gy = Math.floor(a.y / cell);
    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const list = buckets.get(key(gx + ox, gy + oy));
        if (!list) continue;
        for (const j of list) {
          if (j === i) continue;
          const b = agents[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d >= sepDist) continue;
          // d can be 0 when two agents land exactly together; nudge by index so they separate
          // instead of dividing by zero and freezing on top of each other.
          const nx = d > 0.001 ? dx / d : (i % 2 ? 1 : -1);
          const ny = d > 0.001 ? dy / d : (i % 2 ? -1 : 1);
          const push = (sepDist - d) / sepDist;
          fx += nx * push * env.speed * SEPARATION_FORCE;
          fy += ny * push * env.speed * SEPARATION_FORCE;
        }
      }
    }

    // Fixed props push outward, hard enough to win against the wander pulling inward.
    const dvx = a.x - env.viz.cx;
    const dvy = a.y - env.viz.cy;
    const dv = Math.hypot(dvx, dvy);
    const minV = env.viz.r + env.radius;
    if (dv < minV) {
      // Constant while inside, NOT proportional to how far in. A force that fades out at the
      // boundary balances against the wander pulling inward, and avatars settle just inside the
      // clearance instead of leaving - which is exactly what happened with a proportional push.
      const nx = dv > 0.001 ? dvx / dv : 1;
      const ny = dv > 0.001 ? dvy / dv : 0;
      fx += nx * env.speed * OBSTACLE_FORCE;
      fy += ny * env.speed * OBSTACLE_FORCE;
    }
    for (const r of env.rects) {
      const x0 = r.x0 - env.radius;
      const x1 = r.x1 + env.radius;
      const y0 = r.y0 - env.radius;
      const y1 = r.y1 + env.radius;
      if (a.x <= x0 || a.x >= x1 || a.y <= y0 || a.y >= y1) continue;
      // Leave by the nearest edge that actually has floor beyond it. The PA stacks run off the
      // side of the region, so "shortest way out" can be a direction where the region clamp puts
      // the avatar straight back inside the prop - which is how one used to get stuck in there.
      const exits: [number, number, number][] = [
        [a.x - x0, -1, 0],
        [x1 - a.x, 1, 0],
        [a.y - y0, 0, -1],
        [y1 - a.y, 0, 1],
      ];
      const reachable = exits.filter(([, ex, ey]) =>
        (ex < 0 ? x0 > env.region.x0 : ex > 0 ? x1 < env.region.x1 : true) &&
        (ey < 0 ? y0 > env.region.y0 : ey > 0 ? y1 < env.region.y1 : true));
      const [, ex, ey] = (reachable.length ? reachable : exits)
        .reduce((best, cur) => (cur[0] < best[0] ? cur : best));
      fx += ex * env.speed * OBSTACLE_FORCE;
      fy += ey * env.speed * OBSTACLE_FORCE;
    }

    // Velocity is damped rather than integrated, so a crowded pocket cannot build up speed and
    // fling somebody across the room.
    a.vx = a.vx * 0.82 + fx * 0.18;
    a.vy = a.vy * 0.82 + fy * 0.18;
    const sp = Math.hypot(a.vx, a.vy);
    const maxSp = env.speed * 3;
    if (sp > maxSp) { a.vx = (a.vx / sp) * maxSp; a.vy = (a.vy / sp) * maxSp; }

    a.x = clamp(a.x + a.vx * dt, env.region.x0, env.region.x1);
    a.y = clamp(a.y + a.vy * dt, env.region.y0, env.region.y1);
    resolveObstacles(a, env);
  }
}
