import { describe, it, expect } from 'vitest';
import { nextBitrateKbps, preferOpusStereo, QUALITY_PRESETS, BITRATE_FLOOR_KBPS } from './audioQuality';

describe('nextBitrateKbps (adaptive control)', () => {
  const ceiling = 128;

  it('backs off hard on heavy packet loss', () => {
    expect(nextBitrateKbps({ current: 128, lossFraction: 0.2, ceiling })).toBe(90); // 128*0.7
  });

  it('eases off on moderate loss', () => {
    expect(nextBitrateKbps({ current: 128, lossFraction: 0.05, ceiling })).toBe(109); // 128*0.85
  });

  it('recovers additively on a clean line, up to the ceiling', () => {
    expect(nextBitrateKbps({ current: 96, lossFraction: 0, ceiling })).toBe(112); // +16
    expect(nextBitrateKbps({ current: 120, lossFraction: 0, ceiling })).toBe(128); // capped
  });

  it('holds steady in the neutral band', () => {
    expect(nextBitrateKbps({ current: 100, lossFraction: 0.02, ceiling })).toBe(100);
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

describe('preferOpusStereo (SDP shaping)', () => {
  const sdp =
    'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' +
    'a=rtpmap:111 opus/48000/2\r\n' +
    'a=fmtp:111 minptime=10;useinbandfec=1\r\n';

  it('adds stereo + FEC + maxaveragebitrate to the Opus fmtp line', () => {
    const out = preferOpusStereo(sdp, 128000);
    expect(out).toMatch(/a=fmtp:111 [^\r\n]*stereo=1/);
    expect(out).toMatch(/sprop-stereo=1/);
    expect(out).toMatch(/useinbandfec=1/);
    expect(out).toMatch(/maxaveragebitrate=128000/);
    expect(out).toMatch(/minptime=10/); // preserves existing params
  });

  it('does not duplicate keys it overrides', () => {
    const out = preferOpusStereo(sdp, 96000);
    expect(out.match(/useinbandfec=1/g)?.length).toBe(1);
  });

  it('adds an fmtp line when none exists', () => {
    const noFmtp = 'v=0\r\na=rtpmap:111 opus/48000/2\r\n';
    const out = preferOpusStereo(noFmtp, 160000);
    expect(out).toMatch(/a=fmtp:111 stereo=1;sprop-stereo=1;useinbandfec=1;maxaveragebitrate=160000/);
  });

  it('returns the SDP unchanged when there is no Opus payload', () => {
    const noOpus = 'v=0\r\na=rtpmap:0 PCMU/8000\r\n';
    expect(preferOpusStereo(noOpus, 128000)).toBe(noOpus);
  });

  it('omits maxaveragebitrate when not provided', () => {
    const out = preferOpusStereo(sdp);
    expect(out).not.toMatch(/maxaveragebitrate/);
    expect(out).toMatch(/stereo=1/);
  });
});

describe('QUALITY_PRESETS', () => {
  it('exposes stable/balanced/hq ceilings', () => {
    expect(QUALITY_PRESETS).toEqual({ stable: 96, balanced: 128, hq: 160 });
  });
});
