import type { ConnectionEvent } from './connectionFsm';
import { tuneOpus } from './audioQuality';

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

  constructor(
    private readonly callbacks: SubscriberCallbacks,
    private readonly apiUrl = '/api/rtc-session',
    private readonly getAuthToken: () => Promise<string>,
    // A one-way broadcast tolerates latency, so we buffer ~1.5s by default. A deeper jitter
    // buffer absorbs network jitter and gives FEC/retransmits time to fill gaps, which is the
    // single biggest reducer of audible cuts. Trade-off: that much added delay (fine for radio).
    private readonly bufferMs = 1500,
  ) {}

  async connect(): Promise<void> {
    this.pc = new RTCPeerConnection({ iceTransportPolicy: 'all' });

    this.pc.ontrack = (event) => {
      this.applyJitterBuffer(event.receiver);
      // Cloudflare Realtime delivers the track inside streams[0]
      if (event.streams[0]) {
        this.callbacks.onStreamReady(event.streams[0]);
      }
    };

    this.pc.onconnectionstatechange = () => {
      const s = this.pc?.connectionState;
      if (s === 'connected') this.callbacks.onDispatch({ type: 'CONNECTED' });
      else if (s === 'disconnected' || s === 'failed') {
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
    }
    // ontrack fires once ICE negotiation succeeds; CONNECTED dispatch happens there.
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

  disconnect(): void {
    this.pc?.close();
    this.pc = null;
  }
}
