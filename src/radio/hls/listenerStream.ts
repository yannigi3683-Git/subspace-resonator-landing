// Guest deep-buffer HLS transport. Attaches an HLS stream to a hidden media element so the
// listener gets a 15-30s buffer past WebRTC's ~3s NetEq ceiling (no cuts, no BPM warp, survives
// mobile screen-lock). iOS/Safari play HLS natively; every other browser uses hls.js. The element
// MUST be a <video> (audio-only HLS on <audio> hits the iOS "play-with-a-slash" bug).

export function supportsNativeHls(el: HTMLMediaElement): boolean {
  return el.canPlayType('application/vnd.apple.mpegurl') !== '';
}

// Deep-buffer, ride-the-dip config (NOT low-latency): we WANT the latency to absorb 4G blips.
const HLS_CONFIG = {
  lowLatencyMode: false,
  liveSyncDuration: 15,
  liveMaxLatencyDuration: 30,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  backBufferLength: 30,
  maxLiveSyncPlaybackRate: 1,
  liveDurationInfinity: true,
} as const;

export interface HlsHandle {
  destroy(): void;
}

// hls.js gives up after its own retries and emits a FATAL error, then sits there dead. Nothing was
// listening for that, so a listener whose connection dropped lost the deep buffer for the rest of
// the broadcast and only a page reload brought it back (confirmed on a real phone 2026-09-10).
// The library's documented recovery is startLoad() for a network failure and recoverMediaError()
// for a decode failure.
//
// Throttled, because a stream that is genuinely gone (restreamer off) would otherwise have every
// listener retrying in a tight loop against R2. One attempt per cooldown, and if recovery never
// takes, the transport's existing stall detection still drops them to WebRTC.
export const RECOVER_COOLDOWN_MS = 3000;

export type HlsRecovery = 'startLoad' | 'recoverMedia' | 'none';

/** Pure decision so the policy is testable without hls.js or a network. */
export function recoveryAction(
  fatal: boolean,
  kind: 'network' | 'media' | 'other',
  msSinceLastAttempt: number,
  cooldownMs: number = RECOVER_COOLDOWN_MS,
): HlsRecovery {
  if (!fatal) return 'none';
  if (msSinceLastAttempt < cooldownMs) return 'none';
  if (kind === 'network') return 'startLoad';
  if (kind === 'media') return 'recoverMedia';
  return 'none';
}

function clearSrc(el: HTMLMediaElement): HlsHandle {
  return {
    destroy() {
      el.removeAttribute('src');
      el.load();
    },
  };
}

// Attaches streamUrl to el and returns a handle whose destroy() tears the transport down.
// Caller still owns el.play() (must run inside the user's tap gesture on iOS) and volume.
//
// Priority: hls.js FIRST wherever it works (Android, desktop, iPad-with-MSE) — it gives real buffer
// control. Native HLS is used ONLY when hls.js is unsupported, i.e. iPhone Safari (no MSE). Do NOT
// select native off canPlayType: Android Chrome reports 'maybe' for the HLS mime but plays it janky
// (slow-motion/cutting), so trusting canPlayType first breaks Android.
export async function attachHls(el: HTMLMediaElement, streamUrl: string): Promise<HlsHandle> {
  const { default: Hls } = await import('hls.js');
  if (Hls.isSupported()) {
    const hls = new Hls(HLS_CONFIG);

    let lastAttempt = 0;
    hls.on(Hls.Events.ERROR, (_event, data) => {
      const kind = data.type === Hls.ErrorTypes.NETWORK_ERROR ? 'network'
        : data.type === Hls.ErrorTypes.MEDIA_ERROR ? 'media'
          : 'other';
      const action = recoveryAction(!!data.fatal, kind, Date.now() - lastAttempt);
      if (action === 'none') return;
      lastAttempt = Date.now();
      if (action === 'startLoad') hls.startLoad();
      else hls.recoverMediaError();
    });

    hls.loadSource(streamUrl);
    hls.attachMedia(el);
    return {
      destroy() {
        hls.destroy();
      },
    };
  }
  // hls.js unsupported: iPhone Safari (native HLS) or, last-ditch, whatever the element accepts.
  el.src = streamUrl;
  return clearSrc(el);
}
