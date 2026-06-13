// Cloudflare Realtime (Calls) SFU REST client — server-side only.
// Docs: https://developers.cloudflare.com/calls/
// Base URL verified against CF docs 2026-06-12.

const CF_BASE = 'https://rtc.live.cloudflare.com/v1';

function appId(): string {
  const id = process.env.CF_REALTIME_APP_ID;
  if (!id) throw new Error('CF_REALTIME_APP_ID env var not set');
  return id;
}

function appSecret(): string {
  const secret = process.env.CF_REALTIME_APP_SECRET;
  if (!secret) throw new Error('CF_REALTIME_APP_SECRET env var not set');
  return secret;
}

async function cfPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${CF_BASE}/apps/${appId()}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appSecret()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CF POST ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function cfPut(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${CF_BASE}/apps/${appId()}${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${appSecret()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CF PUT ${path} → ${res.status}: ${text}`);
  }
}

interface CfNewSessionResponse {
  sessionId: string;
}

interface CfTracksResponse {
  tracks: Array<{ mid: string; trackName: string; status: string }>;
  requiresImmediateRenegotiation?: boolean;
  sessionDescription?: { type: string; sdp: string };
}

export async function createCfSession(): Promise<string> {
  const data = await cfPost<CfNewSessionResponse>('/sessions/new', {});
  return data.sessionId;
}

// Publisher pushes a local audio track to CF via the SDP offer/answer exchange.
export async function publishAudioTrack(
  cfSessionId: string,
  sdpOffer: string,
): Promise<{ sdpAnswer: string }> {
  const data = await cfPost<CfTracksResponse>(`/sessions/${cfSessionId}/tracks/new`, {
    tracks: [
      {
        location: 'local',
        trackName: 'audio-main',
        sessionDescription: { type: 'offer', sdp: sdpOffer },
      },
    ],
  });
  const sdp = data.sessionDescription?.sdp;
  if (!sdp) throw new Error('CF publishAudioTrack: no sdp in response');
  return { sdpAnswer: sdp };
}

// Subscriber pulls the host's published audio track. CF responds with an
// SDP offer that the subscriber must answer (renegotiation required).
export async function pullAudioTrack(
  cfSessionId: string,
  hostCfSessionId: string,
): Promise<{ cfOffer: string }> {
  const data = await cfPost<CfTracksResponse>(`/sessions/${cfSessionId}/tracks/new`, {
    tracks: [
      {
        location: 'remote',
        trackName: 'audio-main',
        sessionId: hostCfSessionId,
      },
    ],
  });
  const sdp = data.sessionDescription?.sdp;
  if (!sdp) throw new Error('CF pullAudioTrack: no sdp in response');
  return { cfOffer: sdp };
}

// Complete subscriber ICE negotiation by giving CF the browser's SDP answer.
export async function renegotiate(cfSessionId: string, sdpAnswer: string): Promise<void> {
  await cfPut(`/sessions/${cfSessionId}/renegotiate`, {
    sessionDescription: { type: 'answer', sdp: sdpAnswer },
  });
}
