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
