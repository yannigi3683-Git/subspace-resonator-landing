// R2 (S3-compatible) sink: mirror the HLS work dir to a Cloudflare R2 bucket with the right cache
// headers (segments immutable, playlist max-age=1, playlist uploaded LAST so it never points at a
// segment that isn't up yet). ponytail: 1s dir poll, not fs.watch — cross-platform and segments
// only appear every few seconds anyway. Untested end-to-end until a real bucket exists (needs creds).
import { readdir as fsReaddir, readFile as fsReadFile, stat as fsStat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const TYPES = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
};

// DI hooks (_s3/_readdir/_stat/_readFile/_setTimeout) exist so the scan loop can be tested offline
// with a fake S3 client — no bucket, no network. Production passes none of them.
export async function startR2Sink({
  outDir, r2, publicBaseUrl, prefix, log = () => {},
  _s3, _readdir = fsReaddir, _stat = fsStat, _readFile = fsReadFile, _setTimeout = setTimeout,
}) {
  let s3 = _s3;
  let PutObjectCommand = null; // real SDK command class; stays null on the injected-fake (test) path
  if (!s3) {
    const aws = await import('@aws-sdk/client-s3');
    PutObjectCommand = aws.PutObjectCommand;
    // A stalled PUT on free-tier r2.dev must abort fast and retry, not hang the whole scan for ~30s.
    // connectionTimeout/requestTimeout bound each attempt; maxAttempts lets a transient ECONNRESET
    // (already in the SDK's retryable set) self-heal instead of surfacing as a scan error.
    let requestHandler;
    try {
      const { NodeHttpHandler } = await import('@smithy/node-http-handler');
      requestHandler = new NodeHttpHandler({ connectionTimeout: 3000, requestTimeout: 10000 });
    } catch { /* handler pkg absent: keep default handler, retries below still apply */ }
    s3 = new aws.S3Client({
      region: 'auto',
      endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
      maxAttempts: 5,
      ...(requestHandler ? { requestHandler } : {}),
    });
  }

  const seen = new Map(); // filename -> size; segments are write-once so size change => re-upload
  async function put(name, isPlaylist) {
    const body = await _readFile(join(outDir, name));
    const params = {
      Bucket: r2.bucket,
      Key: `${prefix}/${name}`,
      Body: body,
      ContentType: TYPES[extname(name)] || 'application/octet-stream',
      CacheControl: isPlaylist ? 'max-age=1' : 'public, max-age=31536000, immutable',
    };
    await s3.send(PutObjectCommand ? new PutObjectCommand(params) : { input: params });
  }

  async function scan() {
    const files = await _readdir(outDir);
    // Segments + init first, playlist last. A segment can be deleted by ffmpeg's rolling window
    // between readdir and stat/read (ENOENT); skip that one file. A single upload failure (e.g. one
    // ECONNRESET) must NOT abort the whole scan either — log it and move on, or the playlist
    // (uploaded last) stops refreshing and listeners starve.
    for (const f of files.filter((f) => f !== 'stream.m3u8')) {
      try {
        const size = (await _stat(join(outDir, f))).size;
        if (seen.get(f) === size) continue;
        await put(f, false);
        seen.set(f, size);
      } catch (e) {
        if (e?.code !== 'ENOENT') log('r2 put', f, e.message); // vanished segment is fine; log the rest, keep going
      }
    }
    if (files.includes('stream.m3u8')) {
      await put('stream.m3u8', true).catch((e) => {
        if (e?.code !== 'ENOENT') log('r2 put', 'stream.m3u8', e.message);
      });
    }
  }

  // Serialize scans: run one, then schedule the next 1s AFTER it settles. The old setInterval never
  // waited, so a stalled R2 upload let scans pile up — a self-inflicted connection storm that R2
  // reset all at once (the ECONNRESET flood). One scan at a time removes the pileup.
  let stopped = false;
  let timer = null;
  async function tick() {
    if (stopped) return;
    await scan().catch((e) => log('r2 scan', e.message));
    if (!stopped) timer = _setTimeout(tick, 1000);
  }
  tick();

  return {
    publicUrl: `${publicBaseUrl}/${prefix}/stream.m3u8`,
    stop() { stopped = true; if (timer) clearTimeout(timer); },
  };
}
