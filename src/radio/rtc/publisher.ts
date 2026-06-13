import type { ConnectionEvent } from './connectionFsm';

export interface PublisherCallbacks {
  onSessionReady: (cfSessionId: string) => void;
  onDispatch: (event: ConnectionEvent) => void;
  onQualityChange: (degraded: boolean) => void;
}

interface PublishOfferResponse {
  cfSessionId: string;
  sdpAnswer: string;
}

export class Publisher {
  private pc: RTCPeerConnection | null = null;
  private statsInterval: ReturnType<typeof setInterval> | null = null;
  private lastBytesSent = 0;
  private lastStatsTime = 0;

  constructor(
    private readonly callbacks: PublisherCallbacks,
    private readonly apiUrl = '/api/rtc-session',
    private readonly getAuthToken: () => string,
  ) {}

  async connect(stream: MediaStream): Promise<void> {
    this.pc = new RTCPeerConnection({ iceTransportPolicy: 'all' });

    for (const track of stream.getAudioTracks()) {
      this.pc.addTrack(track, stream);
    }

    this.pc.onconnectionstatechange = () => {
      const s = this.pc?.connectionState;
      if (s === 'connected') this.callbacks.onDispatch({ type: 'CONNECTED' });
      else if (s === 'disconnected' || s === 'failed') {
        this.callbacks.onDispatch({ type: 'DISCONNECTED' });
      }
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // FR-4: stereo Opus ~256kbps (setParameters after setLocalDescription)
    await this.applyFr4Bitrate();

    let res: Response;
    try {
      res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'publish-offer', sdpOffer: offer.sdp }),
      });
    } catch {
      this.callbacks.onDispatch({ type: 'ERROR' });
      return;
    }

    if (!res.ok) {
      this.callbacks.onDispatch({ type: 'ERROR' });
      return;
    }

    const data = (await res.json()) as PublishOfferResponse;
    await this.pc.setRemoteDescription({ type: 'answer', sdp: data.sdpAnswer });
    this.callbacks.onSessionReady(data.cfSessionId);
    this.startStatsMonitor();
  }

  // FR-4: 256kbps max on the audio sender.
  // Voice processing (echoCancellation, AGC, noiseSuppression) and DTX are
  // controlled by the getUserMedia constraints upstream in hostMixer; this
  // method handles the bitrate cap which must run post-setLocalDescription.
  private async applyFr4Bitrate(): Promise<void> {
    if (!this.pc) return;
    for (const sender of this.pc.getSenders()) {
      if (sender.track?.kind !== 'audio') continue;
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];
      params.encodings[0].maxBitrate = 256_000;
      try {
        await sender.setParameters(params);
      } catch {
        // Non-fatal: some browsers reject setParameters before ICE completes.
      }
    }
  }

  private startStatsMonitor(): void {
    this.lastStatsTime = Date.now();
    this.statsInterval = setInterval(async () => {
      if (!this.pc) return;
      const stats = await this.pc.getStats();
      let bytesSent = 0;
      stats.forEach((report) => {
        if (report.type === 'outbound-rtp' && (report as RTCOutboundRtpStreamStats).kind === 'audio') {
          bytesSent = (report as RTCOutboundRtpStreamStats).bytesSent ?? 0;
        }
      });

      const now = Date.now();
      const elapsed = (now - this.lastStatsTime) / 1000;
      const bps = elapsed > 0 ? ((bytesSent - this.lastBytesSent) * 8) / elapsed : 0;
      this.lastBytesSent = bytesSent;
      this.lastStatsTime = now;

      // Below 20kbps indicates Opus stopped sending (silence suppression or stall).
      // With DTX off this should only happen on a genuine stall.
      const degraded = bps < 20_000;
      this.callbacks.onQualityChange(degraded);
    }, 3_000);
  }

  disconnect(): void {
    if (this.statsInterval !== null) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.pc?.close();
    this.pc = null;
    this.lastBytesSent = 0;
  }
}
