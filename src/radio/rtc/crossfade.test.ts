import { describe, it, expect } from 'vitest';
import { shouldStartCrossfade, clampCrossfadeSec } from './crossfade';

const base = {
  currentTime: 0,
  duration: 200,
  crossfadeSec: 6,
  autoMix: true,
  hasNext: true,
  alreadyFading: false,
};

describe('shouldStartCrossfade', () => {
  it('fires once remaining time falls within the crossfade window', () => {
    expect(shouldStartCrossfade({ ...base, currentTime: 195 })).toBe(true); // 5s left, window 6
  });

  it('does not fire while there is more time than the window', () => {
    expect(shouldStartCrossfade({ ...base, currentTime: 190 })).toBe(false); // 10s left
  });

  it('does not fire when auto-mix is off', () => {
    expect(shouldStartCrossfade({ ...base, currentTime: 198, autoMix: false })).toBe(false);
  });

  it('does not fire when there is no next track', () => {
    expect(shouldStartCrossfade({ ...base, currentTime: 198, hasNext: false })).toBe(false);
  });

  it('does not fire when already fading', () => {
    expect(shouldStartCrossfade({ ...base, currentTime: 198, alreadyFading: true })).toBe(false);
  });

  it('does not fire when the duration is unknown (NaN/Infinity/0)', () => {
    expect(shouldStartCrossfade({ ...base, currentTime: 10, duration: NaN })).toBe(false);
    expect(shouldStartCrossfade({ ...base, currentTime: 10, duration: Infinity })).toBe(false);
    expect(shouldStartCrossfade({ ...base, currentTime: 0, duration: 0 })).toBe(false);
  });

  it('does not fire after the track has already ended', () => {
    expect(shouldStartCrossfade({ ...base, currentTime: 200 })).toBe(false); // remaining 0
  });
});

describe('clampCrossfadeSec', () => {
  it('keeps values within 1–30', () => {
    expect(clampCrossfadeSec(6)).toBe(6);
    expect(clampCrossfadeSec(1)).toBe(1);
    expect(clampCrossfadeSec(12)).toBe(12);
    expect(clampCrossfadeSec(30)).toBe(30);
  });

  it('clamps out-of-range values', () => {
    expect(clampCrossfadeSec(0)).toBe(1);
    expect(clampCrossfadeSec(99)).toBe(30);
  });

  it('rounds fractional values and defaults NaN to 1', () => {
    expect(clampCrossfadeSec(6.4)).toBe(6);
    expect(clampCrossfadeSec(NaN)).toBe(1);
  });
});
