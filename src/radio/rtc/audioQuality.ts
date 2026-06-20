// Pure helpers for audio quality + adaptive bitrate. Kept side-effect free so the control
// loop and SDP shaping are unit-testable without a live RTCPeerConnection.

export type QualityKey = 'stable' | 'balanced' | 'hq';

// Ceiling bitrates (kbps) the host can choose. The adaptive loop rides at or below the
// chosen ceiling and never above it.
export const QUALITY_PRESETS: Record<QualityKey, number> = {
  stable: 96,
  balanced: 128,
  hq: 160,
};

export const QUALITY_LABELS: Record<QualityKey, string> = {
  stable: 'STABLE 96k',
  balanced: 'BALANCED 128k',
  hq: 'HQ 160k',
};

// Never drop below this — Opus stays intelligible for music down to ~48 kbps.
export const BITRATE_FLOOR_KBPS = 48;

const INCREASE_STEP_KBPS = 16;

/**
 * AIMD-style bitrate controller. On packet loss it backs off multiplicatively (fast); on a
 * clean line it recovers additively (slow) up to the ceiling. Clamps to [floor, ceiling].
 * Returns the next target bitrate in kbps.
 */
export function nextBitrateKbps(p: {
  current: number;
  lossFraction: number;
  ceiling: number;
  floor?: number;
}): number {
  const floor = p.floor ?? BITRATE_FLOOR_KBPS;
  const ceiling = Math.max(floor, p.ceiling);
  let current = p.current;

  // The ceiling may have just been lowered by the host — clamp down immediately.
  if (current > ceiling) return ceiling;
  if (current < floor) current = floor;

  const loss = Math.max(0, Math.min(1, p.lossFraction));
  if (loss > 0.08) return Math.max(floor, Math.round(current * 0.7)); // heavy loss: big cut
  if (loss > 0.03) return Math.max(floor, Math.round(current * 0.85)); // some loss: ease off
  if (loss < 0.01) return Math.min(ceiling, current + INCREASE_STEP_KBPS); // clean: recover
  return current;
}

/**
 * Force stereo Opus (music, not voice) and inband FEC (packet-loss concealment) on the
 * SDP offer, plus an optional maxaveragebitrate hint. WebRTC negotiates mono by default,
 * which is wrong for a DJ stream. Returns the SDP unchanged if no Opus payload is found.
 */
export function preferOpusStereo(sdp: string, maxAverageBitrate?: number): string {
  const rtpmap = sdp.match(/^a=rtpmap:(\d+)\s+opus\/48000(?:\/2)?/im);
  if (!rtpmap) return sdp;
  const pt = rtpmap[1];

  const wanted = ['stereo=1', 'sprop-stereo=1', 'useinbandfec=1'];
  if (maxAverageBitrate && maxAverageBitrate > 0) {
    wanted.push(`maxaveragebitrate=${Math.round(maxAverageBitrate)}`);
  }
  const overriddenKeys = wanted.map((kv) => kv.split('=')[0]);

  const fmtpRe = new RegExp(`^a=fmtp:${pt} (.*)$`, 'im');
  if (fmtpRe.test(sdp)) {
    return sdp.replace(fmtpRe, (_line, existing: string) => {
      const keep = existing
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((kv) => !overriddenKeys.includes(kv.split('=')[0]));
      return `a=fmtp:${pt} ${[...keep, ...wanted].join(';')}`;
    });
  }

  // No fmtp line yet — add one right after the rtpmap line.
  const rtpmapLineRe = new RegExp(`^(a=rtpmap:${pt} opus/48000(?:/2)?.*)$`, 'im');
  return sdp.replace(rtpmapLineRe, `$1\r\na=fmtp:${pt} ${wanted.join(';')}`);
}
