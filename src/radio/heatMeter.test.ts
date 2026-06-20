import { describe, it, expect } from 'vitest';
import { aggregateHeat, heatToAngle, clamp01 } from './heatMeter';

describe('aggregateHeat', () => {
  it('defaults to neutral 0.5 with no votes', () => {
    expect(aggregateHeat([])).toBe(0.5);
  });

  it('averages votes', () => {
    expect(aggregateHeat([0, 1])).toBe(0.5);
    expect(aggregateHeat([1, 1, 1])).toBe(1);
    expect(aggregateHeat([0, 0, 1])).toBeCloseTo(1 / 3);
  });

  it('clamps out-of-range votes', () => {
    expect(aggregateHeat([2, -1])).toBe(0.5); // -> [1, 0]
  });
});

describe('heatToAngle', () => {
  it('maps cool/neutral/hot to -90 / 0 / +90 degrees', () => {
    expect(heatToAngle(0)).toBe(-90);
    expect(heatToAngle(0.5)).toBe(0);
    expect(heatToAngle(1)).toBe(90);
  });
});

describe('clamp01', () => {
  it('clamps and defaults NaN to 0.5', () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(3)).toBe(1);
    expect(clamp01(NaN)).toBe(0.5);
  });
});
