import { describe, it, expect } from 'vitest';
import { crossfadeVolumes } from './useListenerTransport';

describe('crossfadeVolumes', () => {
  it('starts fully on WebRTC', () => {
    expect(crossfadeVolumes(0, 15, 1)).toEqual({ webrtc: 1, hls: 0 });
  });
  it('ends fully on HLS', () => {
    expect(crossfadeVolumes(15, 15, 1)).toEqual({ webrtc: 0, hls: 1 });
  });
  it('is balanced at the midpoint', () => {
    expect(crossfadeVolumes(7.5, 15, 1)).toEqual({ webrtc: 0.5, hls: 0.5 });
  });
  it('scales to the user volume', () => {
    const v = crossfadeVolumes(15, 15, 0.4);
    expect(v.hls).toBeCloseTo(0.4);
    expect(v.webrtc).toBe(0);
  });
  it('clamps steps beyond the end (never negative / overshoot)', () => {
    expect(crossfadeVolumes(99, 15, 1)).toEqual({ webrtc: 0, hls: 1 });
  });
});
