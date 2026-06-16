import type { ConnectionEvent } from './connectionFsm';

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
  ) {}

  async connect(): Promise<void> {
    this.pc = new RTCPeerConnection({ iceTransportPolicy: 'all' });

    this.pc.ontrack = (event) => {
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

  disconnect(): void {
    this.pc?.close();
    this.pc = null;
  }
}
