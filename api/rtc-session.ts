import { createClient } from '@supabase/supabase-js';
import { buildChatTranscript, transcriptFilename, type TranscriptRow } from './chatTranscript';

// ---- Cloudflare Realtime REST client (inlined to avoid ESM bundling issues) ----

const CF_BASE = 'https://rtc.live.cloudflare.com/v1';

function cfCleanEnv(v: string | undefined): string {
  return (v ?? '').replace(/[^\x20-\x7E]/g, '');
}

function appId(): string {
  const id = cfCleanEnv(process.env.CF_REALTIME_APP_ID);
  if (!id) throw new Error('CF_REALTIME_APP_ID env var not set');
  return id;
}

function appSecret(): string {
  const secret = cfCleanEnv(process.env.CF_REALTIME_APP_SECRET);
  if (!secret) throw new Error('CF_REALTIME_APP_SECRET env var not set');
  return secret;
}

interface CfNewSessionResponse { sessionId: string; }
interface CfTracksResponse {
  tracks: Array<{ mid: string; trackName: string; status: string }>;
  requiresImmediateRenegotiation?: boolean;
  sessionDescription?: { type: string; sdp: string };
}

async function cfPost<T>(path: string, body?: unknown): Promise<T> {
  // /sessions/new takes no body; sending an empty object trips CF's request validator.
  const headers: Record<string, string> = { Authorization: `Bearer ${appSecret()}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${CF_BASE}/apps/${appId()}${path}`, {
    method: 'POST',
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
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
    headers: { Authorization: `Bearer ${appSecret()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`CF PUT ${path} → ${res.status}: ${text}`);
  }
}

async function createCfSession(): Promise<string> {
  const data = await cfPost<CfNewSessionResponse>('/sessions/new');
  return data.sessionId;
}

// The local offer's audio m-section mid; CF maps the published track to this transceiver.
export function firstMid(sdp: string): string {
  const m = sdp.match(/^a=mid:(\S+)/m);
  return m ? m[1] : '0';
}

async function publishAudioTrack(cfSessionId: string, sdpOffer: string): Promise<{ sdpAnswer: string }> {
  // Per the SFU API: the offer is a TOP-LEVEL sessionDescription and each local track
  // references its transceiver by mid (not a per-track sessionDescription).
  const data = await cfPost<CfTracksResponse>(`/sessions/${cfSessionId}/tracks/new`, {
    sessionDescription: { type: 'offer', sdp: sdpOffer },
    tracks: [{ location: 'local', mid: firstMid(sdpOffer), trackName: 'audio-main' }],
  });
  const sdp = data.sessionDescription?.sdp;
  if (!sdp) throw new Error('CF publishAudioTrack: no sdp in response');
  return { sdpAnswer: sdp };
}

async function pullAudioTrack(cfSessionId: string, hostCfSessionId: string): Promise<{ cfOffer: string }> {
  const data = await cfPost<CfTracksResponse>(`/sessions/${cfSessionId}/tracks/new`, {
    tracks: [{ location: 'remote', trackName: 'audio-main', sessionId: hostCfSessionId }],
  });
  const sdp = data.sessionDescription?.sdp;
  if (!sdp) throw new Error('CF pullAudioTrack: no sdp in response');
  return { cfOffer: sdp };
}

async function renegotiate(cfSessionId: string, sdpAnswer: string): Promise<void> {
  await cfPut(`/sessions/${cfSessionId}/renegotiate`, { sessionDescription: { type: 'answer', sdp: sdpAnswer } });
}

// Mint short-lived TURN credentials from Cloudflare Realtime TURN. Returns null when the
// TURN key env vars are unset or CF errors, so the client cleanly falls back to STUN-only
// rather than failing to connect. TURN is what survives a corporate firewall / CGNAT that
// kills the direct UDP path (relays over TCP/TLS 443).
interface CfTurnCredentials {
  iceServers: { urls: string | string[]; username?: string; credential?: string };
}

async function generateTurnCredentials(): Promise<CfTurnCredentials['iceServers'] | null> {
  const keyId = cfCleanEnv(process.env.CF_TURN_KEY_ID);
  const apiToken = cfCleanEnv(process.env.CF_TURN_KEY_API_TOKEN);
  if (!keyId || !apiToken) {
    console.error('[TURN] env vars missing: keyId=%s apiToken=%s', !!keyId, !!apiToken);
    return null;
  }
  try {
    const res = await fetch(`${CF_BASE}/turn/keys/${keyId}/credentials/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[TURN] CF credentials failed: %d %s', res.status, text);
      return null;
    }
    const data = (await res.json()) as CfTurnCredentials;
    return data.iceServers ?? null;
  } catch (err) {
    console.error('[TURN] fetch threw:', err);
    return null;
  }
}

// ---- Supabase admin client (service-role key; never exposed to browser) ----

// Strip BOM/non-ASCII that PowerShell UTF-16 encoding may prepend to env vars; such a
// char in a key/header value makes Node's fetch reject the request.
function cleanEnv(v: string | undefined): string | undefined {
  return v?.replace(/[^\x20-\x7E]/g, '');
}

function getSupabaseAdmin() {
  const url = cleanEnv(process.env.SUPABASE_URL);
  const key = cleanEnv(process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// A client scoped to the caller's verified JWT, so PostgREST runs the request as that
// authenticated user (auth.uid() = their id). Used for station writes that are gated by
// RLS policies like has_role(auth.uid(),'admin') — this guarantees the write carries the
// admin identity without depending on the browser attaching its session to PostgREST.
function getUserClient(token: string) {
  const url = cleanEnv(process.env.SUPABASE_URL);
  const key = cleanEnv(process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set');
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---- JWT helpers ----

interface JwtPayload {
  sub: string;
  aal?: string;
  exp?: number;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as JwtPayload;
  } catch {
    return null;
  }
}

// Distinguish "the auth service throttled us" from "the token is bad", so a rejection is
// diagnosable in logs instead of a blanket 401. A 429 or a "rate limit" message from Supabase
// means the free-tier auth quota is the ceiling — the exact symptom behind listeners being
// turned away once a crowd arrives.
export function classifyAuthError(
  error: { status?: number; message?: string } | null,
): 'rate_limited' | 'invalid_token' {
  const status = error?.status;
  const msg = (error?.message ?? '').toLowerCase();
  if (status === 429 || msg.includes('rate limit')) return 'rate_limited';
  return 'invalid_token';
}

interface CachedIdentity { userId: string; aal: string; expiresAt: number; }
const TOKEN_TTL_MS = 60_000;
// ponytail: in-memory per-token cache, 60s TTL. Each listener fires ~2 RTC phases seconds
// apart, so a warm function instance collapses them into a single Supabase getUser — easing
// load on the same auth endpoint that gates entry. Upgrade path: local JWKS verify (zero
// round-trips) only if a load test shows one getUser/listener still saturates auth.
const tokenCache = new Map<string, CachedIdentity>();

export function readTokenCache(token: string, now = Date.now()): { userId: string; aal: string } | null {
  const hit = tokenCache.get(token);
  if (!hit) return null;
  if (hit.expiresAt <= now) { tokenCache.delete(token); return null; }
  return { userId: hit.userId, aal: hit.aal };
}

export function writeTokenCache(token: string, userId: string, aal: string, now = Date.now()): void {
  if (tokenCache.size >= 1000) {
    for (const [k, v] of tokenCache) if (v.expiresAt <= now) tokenCache.delete(k);
  }
  tokenCache.set(token, { userId, aal, expiresAt: now + TOKEN_TTL_MS });
}

export type VerifyResult =
  | { ok: true; userId: string; aal: string }
  | { ok: false; reason: 'rate_limited' | 'invalid_token' | 'auth_error' };

async function verifyToken(token: string): Promise<VerifyResult> {
  const cached = readTokenCache(token);
  if (cached) return { ok: true, userId: cached.userId, aal: cached.aal };
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data.user) return { ok: false, reason: classifyAuthError(error) };
    const payload = decodeJwtPayload(token);
    const aal = payload?.aal ?? 'aal1';
    writeTokenCache(token, data.user.id, aal);
    return { ok: true, userId: data.user.id, aal };
  } catch (err) {
    console.error('[rtc-session verifyToken]', err);
    return { ok: false, reason: 'auth_error' };
  }
}

export type AdminCheck = { ok: true } | { ok: false; reason: 'not_aal2' | 'not_admin' };

export async function checkAdminAal2(
  userId: string,
  aal: string,
  client = getSupabaseAdmin(),
): Promise<AdminCheck> {
  if (aal !== 'aal2') return { ok: false, reason: 'not_aal2' };
  try {
    // has_role() is SECURITY DEFINER (see supabase/schema.sql), so it bypasses the
    // RLS on user_roles and works regardless of whether the key bypasses RLS itself.
    const { data, error } = await client.rpc('has_role', { _user_id: userId, _role: 'admin' });
    if (error) return { ok: false, reason: 'not_admin' };
    return data === true ? { ok: true } : { ok: false, reason: 'not_admin' };
  } catch {
    return { ok: false, reason: 'not_admin' };
  }
}

async function readHostCfSessionId(): Promise<string | null> {
  try {
    const { data } = await getSupabaseAdmin()
      .from('station')
      .select('live_session')
      .single();
    const session = data?.live_session as { cfSessionId?: string } | null;
    return session?.cfSessionId ?? null;
  } catch {
    return null;
  }
}

// ---- Response helpers ----

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

// ---- Route handlers ----

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request): Promise<Response> {
  // Require a Bearer token; any authenticated Supabase session qualifies.
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return json({ error: 'unauthorized' }, 401);

  const verified = await verifyToken(token);
  if (!verified.ok) {
    // Log the real reason so a future rejection is provable from server logs. rate_limited =
    // Supabase auth quota is the ceiling (raise it in the dashboard); invalid_token = a genuine
    // bad/expired token. Return 429 for the former so it is visibly distinct.
    console.warn('[rtc] auth-reject reason=%s', verified.reason);
    const status = verified.reason === 'rate_limited' ? 429 : 401;
    return json({ error: 'unauthorized', reason: verified.reason }, status);
  }
  const identity = { userId: verified.userId, aal: verified.aal };

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const phase = body.phase as string | undefined;
  // Diagnostic (temporary): surfaces which side is looping in a reconnect storm.
  console.log('[rtc] phase=%s', phase);

  // ── PUBLISH OFFER ────────────────────────────────────────────────────────
  // Only the host (admin + aal2) may publish. Anyone can subscribe.
  if (phase === 'publish-offer') {
    const check = await checkAdminAal2(identity.userId, identity.aal);
    if (!check.ok) {
      return json({ error: 'forbidden', reason: check.reason }, 403);
    }
    const sdpOffer = body.sdpOffer as string | undefined;
    if (!sdpOffer) return json({ error: 'sdpOffer required' }, 400);

    let cfSessionId: string;
    let sdpAnswer: string;
    try {
      cfSessionId = await createCfSession();
      ({ sdpAnswer } = await publishAudioTrack(cfSessionId, sdpOffer));
    } catch (err) {
      console.error('[rtc-session publish-offer cf]', err);
      return json({ error: 'cf_error' }, 502);
    }

    // Flip the station live server-side using the admin's own token, so the station
    // RLS write policy (has_role on auth.uid()) is satisfied deterministically.
    const title = ((body.title as string | undefined) ?? '').slice(0, 80) || 'Subspace Radio Live';
    const { error: stErr } = await getUserClient(token)
      .from('station')
      .update({ mode: 'live', live_title: title, live_session: { cfSessionId, startedAt: new Date().toISOString() } })
      .eq('id', true);
    if (stErr) {
      console.error('[rtc-session publish-offer station]', stErr);
      return json({ error: 'station_update_failed', detail: stErr.message }, 500);
    }
    return json({ cfSessionId, sdpAnswer });
  }

  // ── END BROADCAST ────────────────────────────────────────────────────────
  // Admin-only: take the station off the air. Runs as the admin's token so the
  // station write policy is satisfied.
  if (phase === 'end-broadcast') {
    const check = await checkAdminAal2(identity.userId, identity.aal);
    if (!check.ok) return json({ error: 'forbidden', reason: check.reason }, 403);
    const admin = getSupabaseAdmin();

    // Read the broadcast meta (start + title) BEFORE we null live_session, so we can build
    // the host's downloadable transcript of this broadcast's chat.
    const { data: st } = await admin
      .from('station')
      .select('live_session, live_title')
      .eq('id', true)
      .single();
    const startedAt = (st?.live_session as { startedAt?: string } | null)?.startedAt ?? null;
    const title = (st?.live_title as string | null) ?? 'Subspace Radio Live';

    // This broadcast's messages only (created_at >= startedAt). Never selects uid/device_id.
    let transcript = '';
    let filename = '';
    const { data: msgs } = await admin
      .from('chat_messages')
      .select('display_name, body, is_host, created_at')
      .gte('created_at', startedAt ?? new Date(0).toISOString())
      .order('created_at', { ascending: true });
    if (msgs && msgs.length) {
      transcript = buildChatTranscript(title, startedAt, msgs as TranscriptRow[]);
      filename = transcriptFilename(startedAt);
    }

    // Take the station off the air. Service-role client so the write succeeds even if the
    // admin's AAL2 JWT has since downgraded to AAL1 during a long broadcast.
    // The chat is NOT wiped: it stays private (RLS: admin-only once off air) and the 48h
    // TTL cron reclaims it. Listeners are floored to the current session so they never see
    // a past broadcast's chat; a new go-live starts them clean.
    const { error: stErr } = await admin
      .from('station')
      .update({ mode: 'off', live_session: null })
      .eq('id', true);
    if (stErr) {
      console.error('[rtc-session end-broadcast]', stErr);
      return json({ error: 'station_update_failed', detail: stErr.message }, 500);
    }
    return json({ ok: true, transcript, filename });
  }

  // ── SUBSCRIBE PULL ───────────────────────────────────────────────────────
  // Any authenticated session (anon is fine) may subscribe. The host's
  // CF session ID is read server-side from station.live_session — the client
  // never sees or supplies it (prevents session-hijack injection).
  if (phase === 'subscribe-pull') {
    const hostCfSessionId = await readHostCfSessionId();
    if (!hostCfSessionId) return json({ error: 'station_offline' }, 503);

    try {
      const cfSessionId = await createCfSession();
      const { cfOffer } = await pullAudioTrack(cfSessionId, hostCfSessionId);
      return json({ cfSessionId, cfOffer });
    } catch (err) {
      console.error('[rtc-session subscribe-pull]', err);
      return json({ error: 'cf_error' }, 502);
    }
  }

  // ── SUBSCRIBE ANSWER ─────────────────────────────────────────────────────
  // Browser sends its SDP answer so CF can complete the ICE negotiation.
  if (phase === 'subscribe-answer') {
    const cfSessionId = body.cfSessionId as string | undefined;
    const sdpAnswer = body.sdpAnswer as string | undefined;
    if (!cfSessionId || !sdpAnswer) {
      return json({ error: 'cfSessionId and sdpAnswer required' }, 400);
    }
    try {
      await renegotiate(cfSessionId, sdpAnswer);
      return json({ ok: true });
    } catch (err) {
      console.error('[rtc-session subscribe-answer]', err);
      return json({ error: 'cf_error' }, 502);
    }
  }

  // ── ICE SERVERS ──────────────────────────────────────────────────────────
  // Any authenticated session may request TURN credentials. The API token never
  // leaves the server; the browser only ever sees short-lived (24h) relay creds.
  if (phase === 'ice-servers') {
    const iceServers = await generateTurnCredentials();
    return json({ iceServers });
  }

  return json({ error: 'unknown_phase' }, 400);
}
