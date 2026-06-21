import { describe, it, expect } from 'vitest';
import { peekVisibleAt, nowPlayingVisible } from './nowPlaying';

describe('peekVisibleAt', () => {
  it('shows for the first 15s after a track change', () => {
    expect(peekVisibleAt(40_000, 0)).toBe(true);
    expect(peekVisibleAt(40_000, 14_999)).toBe(true);
    expect(peekVisibleAt(40_000, 15_001)).toBe(false); // change window passed, mid-cycle
  });

  it('shows for the first 15s of each 60s cycle, hidden otherwise', () => {
    expect(peekVisibleAt(0, -1)).toBe(true);
    expect(peekVisibleAt(14_000, -1)).toBe(true);
    expect(peekVisibleAt(20_000, -1)).toBe(false);
    expect(peekVisibleAt(61_000, -1)).toBe(true); // next cycle
  });
});

describe('nowPlayingVisible', () => {
  it('off is never visible', () => {
    expect(nowPlayingVisible('off', 0, 0)).toBe(false);
    expect(nowPlayingVisible('off', 1000, -1)).toBe(false);
  });

  it('always is always visible', () => {
    expect(nowPlayingVisible('always', 999_999, -1)).toBe(true);
  });

  it('peek defers to the timing window', () => {
    expect(nowPlayingVisible('peek', 5_000, -1)).toBe(true);
    expect(nowPlayingVisible('peek', 30_000, -1)).toBe(false);
  });
});
