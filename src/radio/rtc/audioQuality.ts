// Pure helpers for audio quality + adaptive bitrate. Kept side-effect free so the control
// loop and SDP shaping are unit-testable without a live RTCPeerConnection.

export type QualityKey = 'stable' | 'balanced' | 'hq';

// Ceiling bitrates (kbps) the host can choose. Always stereo; lower bitrate is the stability
// trade-off (stereo at 64k is the compromise). The adaptive loop rides at/below the ceiling.
export const QUALITY_PRESETS: Record<QualityKey, number> = {
  stable: 64,
  balanced: 96,
  hq: 128,
};

export const QUALITY_LABELS: Record<QualityKey, string> = {
  stable: 'STABLE 64k',
  balanced: 'BALANCED 96k',
  hq: 'HQ 128k',
};

// Never drop below this — stereo Opus stays usable for music down to ~40 kbps.
export const BITRATE_FLOOR_KBPS = 40;

const INCREASE_STEP_KBPS = 12;

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

  // Stability-first AIMD: drop hard and early on loss, recover slowly only when very clean.
  const loss = Math.max(0, Math.min(1, p.lossFraction));
  if (loss > 0.05) return Math.max(floor, Math.round(current * 0.6)); // heavy loss: big cut
  if (loss > 0.02) return Math.max(floor, Math.round(current * 0.8)); // some loss: ease off
  if (loss < 0.005) return Math.min(ceiling, current + INCREASE_STEP_KBPS); // clean: recover
  return current;
}

/**
 * Tune the Opus payload in the SDP offer: always enable inband FEC (packet-loss
 * concealment) and an optional maxaveragebitrate hint, and force stereo ONLY when asked
 * (mono is far more upload-resilient, so it is the default). Returns the SDP unchanged if
 * no Opus payload is found.
 */
export function tuneOpus(
  sdp: string,
  opts: { stereo?: boolean; maxAverageBitrate?: number } = {},
): string {
  const rtpmap = sdp.match(/^a=rtpmap:(\d+)\s+opus\/48000(?:\/2)?/im);
  if (!rtpmap) return sdp;
  const pt = rtpmap[1];

  const wanted = ['useinbandfec=1'];
  if (opts.stereo) wanted.push('stereo=1', 'sprop-stereo=1');
  else wanted.push('stereo=0', 'sprop-stereo=0');
  if (opts.maxAverageBitrate && opts.maxAverageBitrate > 0) {
    wanted.push(`maxaveragebitrate=${Math.round(opts.maxAverageBitrate)}`);
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
