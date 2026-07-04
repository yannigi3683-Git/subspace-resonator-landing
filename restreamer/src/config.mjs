// Env config. Every value is sanitized to printable ASCII: past incidents showed PowerShell/Vercel
// stamping invisible BOM/whitespace onto secrets, which then fail in confusing ways downstream.
function clean(v) {
  return (v ?? '').replace(/[^\x20-\x7E]/g, '').trim();
}

export function loadConfig(env = process.env) {
  const cfg = {
    ffmpegPath: clean(env.FFMPEG_PATH) || 'ffmpeg',
    supabaseUrl: clean(env.SUPABASE_URL),
    supabaseSecretKey: clean(env.SUPABASE_SECRET_KEY),
    // How the restreamer authenticates its own pull to the app broker (anonymous listener token).
    supabasePublishableKey: clean(env.SUPABASE_PUBLISHABLE_KEY),
    brokerUrl: clean(env.BROKER_URL), // e.g. https://<preview-or-prod>/api/rtc-session
    // Output sink: 'local' serves over HTTP (dev); 'r2' uploads to Cloudflare R2 (prod).
    sink: clean(env.SINK) || 'local',
    localPort: Number(clean(env.LOCAL_PORT) || '8788'),
    publicBaseUrl: clean(env.PUBLIC_BASE_URL), // base URL listeners fetch from (local or R2 CDN)
    r2: {
      accountId: clean(env.R2_ACCOUNT_ID),
      accessKeyId: clean(env.R2_ACCESS_KEY_ID),
      secretAccessKey: clean(env.R2_SECRET_ACCESS_KEY),
      bucket: clean(env.R2_BUCKET),
    },
    segmentSeconds: Number(clean(env.SEGMENT_SECONDS) || '6'),
    hlsWindow: Number(clean(env.HLS_WINDOW) || '8'),
  };
  return cfg;
}
