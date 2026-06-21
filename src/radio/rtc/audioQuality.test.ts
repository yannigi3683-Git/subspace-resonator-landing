import { describe, it, expect } from 'vitest';
import { nextBitrateKbps, tuneOpus, QUALITY_PRESETS, BITRATE_FLOOR_KBPS, isBitrateAdapting } from './audioQuality';

describe('isBitrateAdapting', () => {
  it('is true only when current is between 1 and below the ceiling', () => {
    expect(isBitrateAdapting(96, 128)).toBe(true);
    expect(isBitrateAdapting(128, 128)).toBe(false); // at ceiling
    expect(isBitrateAdapting(0, 128)).toBe(false); // not yet reporting
  });
});

describe('nextBitrateKbps (adaptive control)', () => {
  const ceiling = 128;

  it('backs off hard on heavy packet loss', () => {
    expect(nextBitrateKbps({ current: 128, lossFraction: 0.2, ceiling })).toBe(77); // 128*0.6
  });

  it('eases off on moderate loss', () => {
    expect(nextBitrateKbps({ current: 128, lossFraction: 0.03, ceiling })).toBe(102); // 128*0.8
  });

  it('recovers additively on a very clean line, up to the ceiling', () => {
    expect(nextBitrateKbps({ current: 96, lossFraction: 0, ceiling })).toBe(108); // +12
    expect(nextBitrateKbps({ current: 120, lossFraction: 0, ceiling })).toBe(128); // capped
  });

  it('holds steady in the neutral band', () => {
    expect(nextBitrateKbps({ current: 100, lossFraction: 0.01, ceiling })).toBe(100);
  });

  it('never drops below the floor', () => {
    expect(nextBitrateKbps({ current: BITRATE_FLOOR_KBPS, lossFraction: 0.5, ceiling })).toBe(
      BITRATE_FLOOR_KBPS,
    );
  });

  it('clamps down immediately when the ceiling is lowered', () => {
    expect(nextBitrateKbps({ current: 160, lossFraction: 0, ceiling: 96 })).toBe(96);
  });
});

describe('tuneOpus (SDP shaping)', () => {
  const sdp =
    'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' +
    'a=rtpmap:111 opus/48000/2\r\n' +
    'a=fmtp:111 minptime=10;useinbandfec=1\r\n';

  it('forces stereo + FEC + maxaveragebitrate when stereo is requested', () => {
    const out = tuneOpus(sdp, { stereo: true, maxAverageBitrate: 128000 });
    expect(out).toMatch(/stereo=1/);
    expect(out).toMatch(/sprop-stereo=1/);
    expect(out).toMatch(/useinbandfec=1/);
    expect(out).toMatch(/maxaveragebitrate=128000/);
    expect(out).toMatch(/minptime=10/); // preserves existing params
  });

  it('marks stereo off when not requested (still keeps FEC)', () => {
    const out = tuneOpus(sdp, { maxAverageBitrate: 96000 });
    expect(out).toMatch(/stereo=0/);
    expect(out).toMatch(/useinbandfec=1/);
  });

  it('does not duplicate keys it overrides', () => {
    const out = tuneOpus(sdp, { stereo: true });
    expect(out.match(/useinbandfec=1/g)?.length).toBe(1);
    // Exclude the "stereo=1" inside "sprop-stereo=1".
    expect(out.match(/(?<!sprop-)stereo=1/g)?.length).toBe(1);
  });

  it('adds an fmtp line when none exists', () => {
    const noFmtp = 'v=0\r\na=rtpmap:111 opus/48000/2\r\n';
    const out = tuneOpus(noFmtp, { stereo: true, maxAverageBitrate: 128000 });
    expect(out).toMatch(/a=fmtp:111 [^\r\n]*stereo=1/);
    expect(out).toMatch(/maxaveragebitrate=128000/);
  });

  it('returns the SDP unchanged when there is no Opus payload', () => {
    const noOpus = 'v=0\r\na=rtpmap:0 PCMU/8000\r\n';
    expect(tuneOpus(noOpus, { stereo: true, maxAverageBitrate: 128000 })).toBe(noOpus);
  });

  it('omits maxaveragebitrate when not provided', () => {
    const out = tuneOpus(sdp, { stereo: true });
    expect(out).not.toMatch(/maxaveragebitrate/);
    expect(out).toMatch(/stereo=1/);
  });
});

describe('QUALITY_PRESETS', () => {
  it('exposes low-bitrate stereo ceilings tuned for stability', () => {
    expect(QUALITY_PRESETS).toEqual({ stable: 64, balanced: 96, hq: 128 });
  });
});
