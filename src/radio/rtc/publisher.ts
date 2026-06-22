import type { ConnectionEvent } from './connectionFsm';
import { tuneOpus, nextBitrateKbps } from './audioQuality';
import { loadIceServers } from './iceServers';

export interface PublisherCallbacks {
  onSessionReady: (cfSessionId: string) => void;
  onDispatch: (event: ConnectionEvent) => void;
  onQualityChange: (degraded: boolean) => void;
  onFatal?: (reason: string) => void;
  /** Reports the current adaptive bitrate (kbps) each stats tick. */
  onBitrate?: (kbps: number) => void;
  /** Reports outbound quality metrics each stats tick. */
  onStats?: (s: { kbps: number; packetsLost: number; lossFraction: number }) => void;
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
  private lastPacketsSent = 0;
  private lastPacketsLost = 0;
  private currentKbps = 128;

  constructor(
    private readonly callbacks: PublisherCallbacks,
    private readonly apiUrl = '/api/rtc-session',
    private readonly getAuthToken: () => Promise<string>,
    private ceilingKbps = 128,
    private readonly stereo = true,
  ) {}

  /** Change the max quality ceiling live; drops the active bitrate immediately if needed. */
  setQualityCeiling(kbps: number): void {
    this.ceilingKbps = kbps;
    if (this.currentKbps > kbps) {
      this.currentKbps = kbps;
      void this.applyBitrate(kbps);
    }
  }

  async connect(stream: MediaStream, title?: string): Promise<void> {
    const iceServers = await loadIceServers(this.apiUrl, this.getAuthToken);
    this.pc = new RTCPeerConnection({ iceTransportPolicy: 'all', iceServers });

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
    // Always stereo (psytrance needs the width) + inband FEC. Stability comes from the low
    // bitrate ceiling, adaptive backoff, and the listener-side jitter buffer — not from mono.
    offer.sdp = tuneOpus(offer.sdp ?? '', {
      stereo: this.stereo,
      maxAverageBitrate: this.ceilingKbps * 1000,
    });
    await this.pc.setLocalDescription(offer);

    // Start at the ceiling; the stats loop adapts down on packet loss.
    this.currentKbps = this.ceilingKbps;
    await this.applyBitrate(this.currentKbps);

    let res: Response;
    try {
      res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await this.getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phase: 'publish-offer', sdpOffer: offer.sdp, title }),
      });
    } catch {
      this.callbacks.onDispatch({ type: 'ERROR' });
      return;
    }

    if (!res.ok) {
      if (res.status === 403) {
        const reason = await res.json().then((b) => b?.reason).catch(() => undefined);
        this.callbacks.onFatal?.(
          reason === 'not_aal2'
            ? 'Two-factor not verified for this session. Log out and sign in again, entering your authenticator code.'
            : 'Admin role missing. Add your user to user_roles in Supabase.',
        );
        return;
      }
      if (res.status === 401) {
        this.callbacks.onFatal?.('Session expired. Refresh the page and log in again.');
        return;
      }
      // 500 = a server-side configuration/logic error (e.g. station_update_failed,
      // missing env var). Retrying never fixes it, so surface it immediately instead
      // of spinning on CONNECTING. 502/503/network are transient → retry.
      if (res.status === 500) {
        this.callbacks.onFatal?.(
          'Broadcast server error. This is a server configuration problem, not your connection. Check the deployment logs.',
        );
        return;
      }
      this.callbacks.onDispatch({ type: 'ERROR' });
      return;
    }

    const data = (await res.json()) as PublishOfferResponse;
    await this.pc.setRemoteDescription({ type: 'answer', sdp: data.sdpAnswer });
    this.callbacks.onSessionReady(data.cfSessionId);
    this.startStatsMonitor();
  }

  // Apply a max bitrate (kbps) to the audio sender. Voice processing and DTX are set
  // upstream in hostMixer; this is the cap, which must run post-setLocalDescription.
  private async applyBitrate(kbps: number): Promise<void> {
    if (!this.pc) return;
    for (const sender of this.pc.getSenders()) {
      if (sender.track?.kind !== 'audio') continue;
      const params = sender.getParameters();
      if (!params.encodings) params.encodings = [{}];
      params.encodings[0].maxBitrate = kbps * 1000;
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
      let packetsSent = 0;
      let packetsLost = 0;
      stats.forEach((report) => {
        const r = report as RTCOutboundRtpStreamStats & { packetsSent?: number; packetsLost?: number };
        if (report.type === 'outbound-rtp' && r.kind === 'audio') {
          bytesSent = r.bytesSent ?? 0;
          packetsSent = r.packetsSent ?? 0;
        }
        // The receiver's loss report comes back over RTCP as remote-inbound-rtp.
        if (report.type === 'remote-inbound-rtp' && r.kind === 'audio') {
          packetsLost = r.packetsLost ?? 0;
        }
      });

      const now = Date.now();
      const elapsed = (now - this.lastStatsTime) / 1000;
      const bps = elapsed > 0 ? ((bytesSent - this.lastBytesSent) * 8) / elapsed : 0;
      this.lastBytesSent = bytesSent;
      this.lastStatsTime = now;

      // Packet loss over the interval drives the adaptive bitrate.
      const dSent = packetsSent - this.lastPacketsSent;
      const dLost = Math.max(0, packetsLost - this.lastPacketsLost);
      this.lastPacketsSent = packetsSent;
      this.lastPacketsLost = packetsLost;
      const lossFraction = dSent + dLost > 0 ? dLost / (dSent + dLost) : 0;

      const next = nextBitrateKbps({
        current: this.currentKbps,
        lossFraction,
        ceiling: this.ceilingKbps,
      });
      if (next !== this.currentKbps) {
        this.currentKbps = next;
        void this.applyBitrate(next);
      }
      this.callbacks.onBitrate?.(this.currentKbps);
      this.callbacks.onStats?.({ kbps: this.currentKbps, packetsLost, lossFraction });

      // Degraded when throughput collapses (stall) or loss is heavy.
      const degraded = bps < 20_000 || lossFraction > 0.08;
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
    this.lastPacketsSent = 0;
    this.lastPacketsLost = 0;
  }
}
