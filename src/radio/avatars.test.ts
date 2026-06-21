import { describe, it, expect } from 'vitest';
import { randomUniqueName, DEFAULT_NAMES } from './avatars';

describe('randomUniqueName', () => {
  it('appends a numeric suffix to a known base name', () => {
    const name = randomUniqueName();
    const m = name.match(/^([A-Za-z]+)(\d{2,3})$/);
    expect(m).not.toBeNull();
    expect(DEFAULT_NAMES).toContain(m![1]);
  });

  it('produces near-unique names across many draws', () => {
    const set = new Set(Array.from({ length: 100 }, () => randomUniqueName()));
    // 20 bases x 900 suffixes = ample space; collisions should be rare.
    expect(set.size).toBeGreaterThanOrEqual(95);
  });
});
