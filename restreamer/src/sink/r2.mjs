// R2 (S3-compatible) sink: mirror the HLS work dir to a Cloudflare R2 bucket with the right cache
// headers (segments immutable, playlist max-age=1, playlist uploaded LAST so it never points at a
// segment that isn't up yet). ponytail: 1s dir poll, not fs.watch — cross-platform and segments
// only appear every few seconds anyway. Untested end-to-end until a real bucket exists (needs creds).
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const TYPES = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
};

export async function startR2Sink({ outDir, r2, publicBaseUrl, prefix, log = () => {} }) {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
  });

  const seen = new Map(); // filename -> size; segments are write-once so size change => re-upload
  async function put(name, isPlaylist) {
    const body = await readFile(join(outDir, name));
    await s3.send(new PutObjectCommand({
      Bucket: r2.bucket,
      Key: `${prefix}/${name}`,
      Body: body,
      ContentType: TYPES[extname(name)] || 'application/octet-stream',
      CacheControl: isPlaylist ? 'max-age=1' : 'public, max-age=31536000, immutable',
    }));
  }

  async function scan() {
    const files = await readdir(outDir);
    // Segments + init first, playlist last. A segment can be deleted by ffmpeg's rolling window
    // between readdir and stat/read (ENOENT); skip that one file — it must NOT abort the whole scan,
    // or the playlist (uploaded last) stops refreshing and listeners starve.
    for (const f of files.filter((f) => f !== 'stream.m3u8')) {
      try {
        const size = (await stat(join(outDir, f))).size;
        if (seen.get(f) === size) continue;
        await put(f, false);
        seen.set(f, size);
      } catch (e) {
        if (e?.code !== 'ENOENT') throw e; // vanished segment is fine; anything else is real
      }
    }
    if (files.includes('stream.m3u8')) await put('stream.m3u8', true).catch((e) => {
      if (e?.code !== 'ENOENT') throw e;
    });
  }

  const iv = setInterval(() => scan().catch((e) => log('r2 scan', e.message)), 1000);
  return {
    publicUrl: `${publicBaseUrl}/${prefix}/stream.m3u8`,
    stop() { clearInterval(iv); },
  };
}
