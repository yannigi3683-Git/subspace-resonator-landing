import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCrowdMotion } from './useCrowdMotion';
import type { CrowdEnv } from '../crowdMotion';

// Spying on the real seeder is the only honest way to tell a carry-over from a re-seed here: a
// seeded position is a pure function of the uid, so both produce identical coordinates until the
// crowd has walked, and the walk needs an rAF loop jsdom does not drive.
const seedSpy = vi.hoisted(() => vi.fn());
vi.mock('../crowdMotion', async (importOriginal) => {
  const real = await importOriginal<typeof import('../crowdMotion')>();
  return { ...real, seedAgents: (uids: string[], e: never) => { seedSpy(uids); return real.seedAgents(uids, e); } };
});

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

/** Positions are written straight to the DOM, so that is where the test reads them from. */
function readXY(node: HTMLElement): [number, number] {
  const m = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(node.style.transform);
  if (!m) throw new Error(`node was never positioned: "${node.style.transform}"`);
  return [Number(m[1]), Number(m[2])];
}

describe('useCrowdMotion', () => {
  beforeEach(() => {
    seedSpy.mockClear();
    window.matchMedia = ((q: string) => ({
      matches: q.includes('reduce'), // no animation loop; the hook still places everyone
      media: q,
      addEventListener() {},
      removeEventListener() {},
    })) as unknown as typeof window.matchMedia;
  });

  // The regression: re-seeding the whole crowd on every join or leave teleported everybody back
  // to their starting layout, and in a busy room that happens faster than the simulation can
  // spread people out - which is what made a crowd above ~50 look permanently clumped.
  it('seeds only the newcomer when someone joins, and nobody when someone leaves', () => {
    const { rerender } = renderHook(
      ({ uids }: { uids: string[] }) => useCrowdMotion(uids, env, true),
      { initialProps: { uids: ['a', 'b', 'c'] } },
    );
    expect(seedSpy).toHaveBeenLastCalledWith(['a', 'b', 'c']);

    rerender({ uids: ['a', 'b', 'c', 'd'] });
    expect(seedSpy).toHaveBeenLastCalledWith(['d']);

    seedSpy.mockClear();
    rerender({ uids: ['a', 'c', 'd'] }); // b leaves
    expect(seedSpy).toHaveBeenCalledWith([]);
  });

  it('reseeds everybody when the floor itself changes size', () => {
    const { result, rerender } = renderHook(
      ({ e }: { e: CrowdEnv }) => useCrowdMotion(['a', 'b'], e, true),
      { initialProps: { e: env } },
    );
    const nodes = [document.createElement('div'), document.createElement('div')];
    result.current.current = nodes;

    seedSpy.mockClear();
    const narrow = { ...env, region: { ...env.region, x1: 700 } };
    rerender({ e: narrow });
    expect(seedSpy).toHaveBeenLastCalledWith(['a', 'b']);
    for (const n of nodes) expect(readXY(n)[0]).toBeLessThanOrEqual(700);
  });
});
