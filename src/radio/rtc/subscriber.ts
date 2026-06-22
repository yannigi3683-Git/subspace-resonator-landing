import type { ConnectionEvent } from './connectionFsm';
import { tuneOpus } from './audioQuality';

export interface SubscriberStats {
  effectiveBufferMs: number;
  packetsLost: number;
  jitterMs: number;
  rttMs: number;
}

export interface SubscriberCallbacks {
  onStreamReady: (stream: MediaStream) => void;
  onDispatch: (event: ConnectionEvent) => void;
}

interface SubscribePullResponse {
  cfSessionId: string;
  cfOffer: string;
}

export class Subscriber {
  private pc: RTCPeerConnection | null = null;
  private receivers: RTCRtpReceiver[] = [];
  private connectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly callbacks: SubscriberCallbacks,
    private readonly apiUrl = '/api/rtc-session',
    private readonly getAuthToken: () => Promise<string>,
    private bufferMs = 5000,
  ) {}

  // Change the jitter buffer live (host can raise it for everyone when cuts are reported).
  setBufferMs(ms: number): void {
    this.bufferMs = ms;
    for (const r of this.receivers) this.applyJitterBuffer(r);
  }

  async connect(): Promise<void> {
    this.pc = new RTCPeerConnection({
      iceTransportPolicy: 'all',
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.pc.ontrack = (event) => {
      // Track arrived — ICE succeeded, cancel the stall timeout.
      if (this.connectTimeoutId !== null) {
        clearTimeout(this.connectTimeoutId);
        this.connectTimeoutId = null;
      }
      this.receivers.push(event.receiver);
      this.applyJitterBuffer(event.receiver);
      // Cloudflare Realtime delivers the track inside streams[0]
      if (event.streams[0]) {
        this.callbacks.onStreamReady(event.streams[0]);
      }
    };

    this.pc.onconnectionstatechange = () => {
      const s = this.pc?.connectionState;
      if (s === 'connected') this.callbacks.onDispatch({ type: 'CONNECTED' });
      else if (s === 'failed') {
        // 'disconnected' is transient — ICE may self-recover; only 'failed' is permanent.
        this.callbacks.onDispatch({ type: 'DISCONNECTED' });
      }
    };

    // Step 1: tell the broker to pull the host's audio track from CF.
    let pullRes: Response;
    try {
      pullRes = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'subscribe-pull' }),
      });
    } catch {
      this.callbacks.onDispatch({ type: 'ERROR' });
      return;
    }

    if (!pullRes.ok) {
      this.callbacks.onDispatch({ type: 'ERROR' });
      return;
    }

    const { cfSessionId, cfOffer } = (await pullRes.json()) as SubscribePullResponse;

    // Step 2: CF sent us an SDP offer for the subscription session.
    // We answer it so CF knows our ICE/codec capabilities.
    await this.pc.setRemoteDescription({ type: 'offer', sdp: cfOffer });
    const answer = await this.pc.createAnswer();
    // Advertise stereo decode in our answer so Cloudflare forwards stereo (not mono) to us.
    answer.sdp = tuneOpus(answer.sdp ?? '', { stereo: true });
    await this.pc.setLocalDescription(answer);

    // Step 3: send our SDP answer back so CF can complete renegotiation.
    let answerRes: Response;
    try {
      answerRes = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phase: 'subscribe-answer',
          cfSessionId,
          sdpAnswer: answer.sdp,
        }),
      });
    } catch {
      this.callbacks.onDispatch({ type: 'ERROR' });
      return;
    }

    if (!answerRes.ok) {
      this.callbacks.onDispatch({ type: 'ERROR' });
      return;
    }

    // ICE negotiation now runs asynchronously. If ontrack hasn't fired within 15s the
    // connection stalled (NAT blocked, network issue, Safari quirk). Surface an error so
    // the listener sees a retry button rather than being stuck at "CONNECTING AUDIO...".
    this.connectTimeoutId = setTimeout(() => {
      this.connectTimeoutId = null;
      this.callbacks.onDispatch({ type: 'ERROR' });
    }, 15_000);
  }

  // Enlarge the receiver's jitter buffer. Prefers the modern jitterBufferTarget (ms),
  // falls back to playoutDelayHint (seconds) on older Chrome; no-ops where unsupported.
  private applyJitterBuffer(receiver: RTCRtpReceiver): void {
    try {
      const r = receiver as unknown as Record<string, unknown>;
      if ('jitterBufferTarget' in r) {
        r.jitterBufferTarget = this.bufferMs; // ms (Chrome 114+)
      } else if ('playoutDelayHint' in r) {
        r.playoutDelayHint = this.bufferMs / 1000; // seconds (older Chrome)
      }
    } catch {
      // Unsupported browser — falls back to the default buffer.
    }
  }

  async getStats(): Promise<SubscriberStats | null> {
    if (!this.pc) return null;
    try {
      const stats = await this.pc.getStats();
      let effectiveBufferMs = 0;
      let packetsLost = 0;
      let jitterMs = 0;
      let rttMs = 0;
      stats.forEach((report) => {
        if (report.type === 'inbound-rtp') {
          const r = report as RTCInboundRtpStreamStats & {
            jitterBufferDelay?: number;
            jitterBufferEmittedCount?: number;
          };
          if (r.kind === 'audio') {
            packetsLost = r.packetsLost ?? 0;
            jitterMs = (r.jitter ?? 0) * 1000;
            if ((r.jitterBufferEmittedCount ?? 0) > 0) {
              effectiveBufferMs = ((r.jitterBufferDelay ?? 0) / r.jitterBufferEmittedCount!) * 1000;
            }
          }
        }
        if (report.type === 'candidate-pair') {
          const r = report as RTCIceCandidatePairStats;
          if (r.nominated && r.currentRoundTripTime !== undefined) {
            rttMs = r.currentRoundTripTime * 1000;
          }
        }
      });
      return { effectiveBufferMs, packetsLost, jitterMs, rttMs };
    } catch {
      return null;
    }
  }

  disconnect(): void {
    if (this.connectTimeoutId !== null) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
    this.pc?.close();
    this.pc = null;
    this.receivers = [];
  }
}
