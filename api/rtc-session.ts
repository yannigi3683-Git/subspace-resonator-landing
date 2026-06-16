import { createClient } from '@supabase/supabase-js';
import { createCfSession, publishAudioTrack, pullAudioTrack, renegotiate } from './_cfCalls';

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

async function verifyToken(token: string): Promise<{ userId: string; aal: string } | null> {
  try {
    const { data, error } = await getSupabaseAdmin().auth.getUser(token);
    if (error || !data.user) return null;
    const payload = decodeJwtPayload(token);
    return { userId: data.user.id, aal: payload?.aal ?? 'aal1' };
  } catch {
    return null;
  }
}

async function isAdminAal2(userId: string, aal: string): Promise<boolean> {
  if (aal !== 'aal2') return false;
  try {
    const { data } = await getSupabaseAdmin()
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();
    return !!data;
  } catch {
    return false;
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

  const identity = await verifyToken(token);
  if (!identity) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const phase = body.phase as string | undefined;

  // ── PUBLISH OFFER ────────────────────────────────────────────────────────
  // Only the host (admin + aal2) may publish. Anyone can subscribe.
  if (phase === 'publish-offer') {
    if (!(await isAdminAal2(identity.userId, identity.aal))) {
      return json({ error: 'forbidden' }, 403);
    }
    const sdpOffer = body.sdpOffer as string | undefined;
    if (!sdpOffer) return json({ error: 'sdpOffer required' }, 400);

    try {
      const cfSessionId = await createCfSession();
      const { sdpAnswer } = await publishAudioTrack(cfSessionId, sdpOffer);
      return json({ cfSessionId, sdpAnswer });
    } catch (err) {
      console.error('[rtc-session publish-offer]', err);
      return json({ error: 'cf_error' }, 502);
    }
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

  return json({ error: 'unknown_phase' }, 400);
}
