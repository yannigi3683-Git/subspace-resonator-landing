// Builds the ICE server list for both publisher and subscriber. Always includes a public
// STUN server; adds Cloudflare TURN (minted server-side, short-lived) when available so the
// connection can relay over TCP/TLS 443 on networks that kill the direct UDP path
// (corporate firewall, CGNAT). On any failure it returns STUN-only — TURN is a fallback,
// never a hard requirement, so a broker hiccup never blocks going live.

const STUN: RTCIceServer = { urls: 'stun:stun.l.google.com:19302' };

interface IceServersResponse {
  iceServers: { urls: string | string[]; username?: string; credential?: string } | null;
}

export async function loadIceServers(
  apiUrl: string,
  getAuthToken: () => Promise<string>,
): Promise<RTCIceServer[]> {
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await getAuthToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phase: 'ice-servers' }),
    });
    if (!res.ok) return [STUN];
    const { iceServers } = (await res.json()) as IceServersResponse;
    if (!iceServers) return [STUN];
    return [STUN, iceServers];
  } catch {
    return [STUN];
  }
}
