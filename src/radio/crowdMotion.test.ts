import { describe, it, expect } from 'vitest';
import { seedAgents, stepAgents, isClear, type CrowdEnv } from './crowdMotion';

const env: CrowdEnv = {
  region: { x0: 30, y0: 210, x1: 1090, y1: 830 },
  viz: { cx: 560, cy: 470, r: 234 },
  rects: [
    { x0: 0, y0: 76, x1: 230, y1: 365 },
    { x0: 860, y0: 76, x1: 1100, y1: 365 },
  ],
  radius: 11,
  speed: 26,
};

const uids = Array.from({ length: 80 }, (_, i) => `uid-${i}`);

/** Run the crowd for a while at the real tick rate. */
function simulate(steps: number, count = uids.length) {
  const agents = seedAgents(uids.slice(0, count), env);
  for (let i = 0; i < steps; i++) stepAgents(agents, env, 1000 / 30);
  return agents;
}

describe('crowd steering', () => {
  it('places everyone clear of the props to begin with', () => {
    for (const a of seedAgents(uids, env)) {
      expect(isClear(a.x, a.y, env), `seeded inside a prop at ${a.x},${a.y}`).toBe(true);
    }
  });

  // The whole reason this simulation exists: territories guaranteed no crossings but caged
  // everyone in their own patch. Here movement is free and avoidance is a force, so the promise
  // is "they push apart", not "they can never touch" - a brush is allowed, a pile-up is not.
  it('keeps avatars apart rather than letting them pile up', () => {
    const agents = simulate(200);
    let worst = Infinity;
    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        worst = Math.min(worst, Math.hypot(agents[i].x - agents[j].x, agents[i].y - agents[j].y));
      }
    }
    // Bodies may brush and slightly overlap, which is what was asked for; they must not stack.
    expect(worst).toBeGreaterThan(env.radius);
  });

  it('never leaves anyone inside the visualizer or a PA stack', () => {
    const inside = simulate(300).filter((a) => !isClear(a.x, a.y, env));
    expect(inside).toEqual([]);
  });

  it('keeps everyone on the floor', () => {
    for (const a of simulate(300)) {
      expect(a.x).toBeGreaterThanOrEqual(env.region.x0);
      expect(a.x).toBeLessThanOrEqual(env.region.x1);
      expect(a.y).toBeGreaterThanOrEqual(env.region.y0);
      expect(a.y).toBeLessThanOrEqual(env.region.y1);
    }
  });

  // Free movement was the point. Territories failed this: everybody stayed in their own patch.
  it('actually moves people across the floor', () => {
    const start = seedAgents(uids, env);
    const before = start.map((a) => ({ x: a.x, y: a.y }));
    for (let i = 0; i < 600; i++) stepAgents(start, env, 1000 / 30);
    const travelled = start
      .map((a, i) => Math.hypot(a.x - before[i].x, a.y - before[i].y))
      .sort((a, b) => a - b);
    expect(travelled[Math.floor(travelled.length / 2)]).toBeGreaterThan(60);
  });

  it('pushes an avatar out if it somehow starts inside the visualizer', () => {
    const agents = seedAgents(['stuck'], env);
    agents[0].x = env.viz.cx;
    agents[0].y = env.viz.cy;
    for (let i = 0; i < 400; i++) stepAgents(agents, env, 1000 / 30);
    expect(isClear(agents[0].x, agents[0].y, env)).toBe(true);
  });

  it('starts everyone in the same place on every client', () => {
    expect(seedAgents(uids, env).map((a) => [a.x, a.y]))
      .toEqual(seedAgents(uids, env).map((a) => [a.x, a.y]));
  });

  it('survives a long stall without flinging anyone across the room', () => {
    const agents = seedAgents(uids, env);
    const before = agents.map((a) => ({ x: a.x, y: a.y }));
    stepAgents(agents, env, 30_000); // tab was backgrounded for 30s
    for (let i = 0; i < agents.length; i++) {
      expect(Math.hypot(agents[i].x - before[i].x, agents[i].y - before[i].y)).toBeLessThan(60);
    }
  });

  it('does nothing with an empty crowd', () => {
    expect(() => stepAgents([], env, 33)).not.toThrow();
  });
});

/**
 * How lumpy a set of positions is: variance-to-mean over a 4x4 grid of the floor. 1.0 is a
 * perfectly even spread, higher is clumpier. The floor has a hole in the middle (the visualizer)
 * so even a flawless crowd scores above 1, which is why every assertion below compares against a
 * uniform-random baseline measured on the same floor rather than against a fixed number.
 */
function clumpiness(points: { x: number; y: number }[], e: CrowdEnv, g = 4): number {
  const { region: r } = e;
  const cells = new Array(g * g).fill(0);
  for (const p of points) {
    const gx = Math.min(g - 1, Math.floor(((p.x - r.x0) / (r.x1 - r.x0)) * g));
    const gy = Math.min(g - 1, Math.floor(((p.y - r.y0) / (r.y1 - r.y0)) * g));
    cells[gy * g + gx]++;
  }
  const mean = points.length / (g * g);
  return cells.reduce((s, v) => s + (v - mean) ** 2, 0) / (g * g) / mean;
}

function uniformBaseline(n: number, e: CrowdEnv): number {
  const runs = Array.from({ length: 25 }, () => {
    const pts: { x: number; y: number }[] = [];
    while (pts.length < n) {
      const x = e.region.x0 + Math.random() * (e.region.x1 - e.region.x0);
      const y = e.region.y0 + Math.random() * (e.region.y1 - e.region.y0);
      if (isClear(x, y, e)) pts.push({ x, y });
    }
    return clumpiness(pts, e);
  });
  return runs.reduce((s, v) => s + v, 0) / runs.length;
}

// A packed floor used to land everyone on one side, because seedAgents read the FIRST output of a
// freshly seeded xorshift32 and that value barely moves between nearby seeds - it became x.
describe('crowd seeding spread', () => {
  const phone: CrowdEnv = {
    region: { x0: 12, y0: 210, x1: 378, y1: 676 },
    viz: { cx: 195, cy: 385, r: 129 },
    rects: [],
    radius: 8,
    speed: 26,
  };

  for (const [label, e] of [['desktop', env], ['phone', phone]] as const) {
    for (const n of [50, 200]) {
      it(`spreads ${n} avatars across the ${label} floor about as evenly as random`, () => {
        // Sequential uids are the worst case (hashes land close together) and are exactly what
        // `?crowdtest=N` generates, so this is the shape the owner actually looks at.
        const crowd = seedAgents(Array.from({ length: n }, (_, i) => `crowdtest-${i}`), e);
        expect(clumpiness(crowd, e)).toBeLessThan(uniformBaseline(n, e) * 1.6);
      });
    }
  }
});
