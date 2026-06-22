// Builds the ICE server list for both publisher and subscriber: STUN-only.
//
// TURN is deliberately NOT added to the browser's candidate pool. With iceTransportPolicy
// 'all', having both a direct pair and a relay pair lets ICE renominate (flap) between them
// whenever consent-freshness / NAT rebinding / Wi-Fi power-save briefly breaks the active
// pair. Each renomination pauses media 1-5s — the audio cuts on home Wi-Fi. With STUN-only
// there is just one (direct) path, so a transient hiccup self-heals on the same pair.
//
// The server-side `ice-servers` phase + credential minting are left intact (unused) so a
// future corporate-only relay path can be reintroduced as an explicit last resort, not in
// the default pool. ponytail: STUN-only on purpose; add opt-in relay later if a restrictive
// network actually needs it.

const STUN: RTCIceServer = { urls: 'stun:stun.l.google.com:19302' };

export async function loadIceServers(
  _apiUrl: string,
  _getAuthToken: () => Promise<string>,
): Promise<RTCIceServer[]> {
  return [STUN];
}
