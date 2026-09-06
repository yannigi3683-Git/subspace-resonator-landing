import { describe, it, expect } from 'vitest';
import { formatClock, formatSetClock } from './format';

describe('formatClock', () => {
  it('formats seconds as m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(65)).toBe('1:05');
    expect(formatClock(125)).toBe('2:05');
    expect(formatClock(3599)).toBe('59:59');
  });

  it('clamps negative / non-finite to 0:00', () => {
    expect(formatClock(-10)).toBe('0:00');
    expect(formatClock(NaN)).toBe('0:00');
    expect(formatClock(Infinity)).toBe('0:00');
  });
});

describe('formatSetClock', () => {
  it('stays m:ss under an hour', () => {
    expect(formatSetClock(0)).toBe('0:00');
    expect(formatSetClock(59)).toBe('0:59');
    expect(formatSetClock(3599)).toBe('59:59');
  });

  it('adds hours at and above an hour', () => {
    expect(formatSetClock(3600)).toBe('1:00:00');
    expect(formatSetClock(3661)).toBe('1:01:01');
    expect(formatSetClock(7325)).toBe('2:02:05');
  });

  it('clamps negative / non-finite to 0:00', () => {
    expect(formatSetClock(-5)).toBe('0:00');
    expect(formatSetClock(NaN)).toBe('0:00');
    expect(formatSetClock(Infinity)).toBe('0:00');
  });
});
