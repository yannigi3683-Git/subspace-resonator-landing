// Server-side Tenor proxy for the radio chat GIF picker. Keeps TENOR_API_KEY off the
// client and FORCES contentfilter=high (NSFW gate for a public live room). Only the small
// tinygif/nanogif formats are requested so GIF traffic never competes with the audio stream.

// Strip BOM/non-ASCII that PowerShell UTF-16 encoding may prepend to env vars.
function cleanEnv(v: string | undefined): string | undefined {
  return v?.replace(/[^\x20-\x7E]/g, '');
}

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

interface TenorResult {
  id: string;
  content_description?: string;
  media_formats?: Record<string, { url?: string }>;
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request): Promise<Response> {
  const key = cleanEnv(process.env.TENOR_API_KEY);
  if (!key) return json({ error: 'tenor_not_configured' }, 503);

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (!q) return json({ results: [] });

  const params = new URLSearchParams({
    q,
    key,
    client_key: 'subspace_radio',
    contentfilter: 'high',
    media_filter: 'tinygif,nanogif',
    limit: '12',
  });

  try {
    const res = await fetch(`https://tenor.googleapis.com/v2/search?${params}`);
    if (!res.ok) {
      console.error('[tenor-search] upstream %d', res.status);
      return json({ error: 'tenor_error' }, 502);
    }
    const data = (await res.json()) as { results?: TenorResult[] };
    const results = (data.results ?? [])
      .map((r) => ({
        id: r.id,
        url: r.media_formats?.tinygif?.url ?? '',
        preview: r.media_formats?.nanogif?.url ?? r.media_formats?.tinygif?.url ?? '',
        alt: r.content_description || 'GIF',
      }))
      .filter((r) => r.url);
    return json({ results });
  } catch (err) {
    console.error('[tenor-search]', err);
    return json({ error: 'tenor_error' }, 502);
  }
}
