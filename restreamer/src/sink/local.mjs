// Local HLS sink: serve the HLS work dir over HTTP with the exact cache/CORS headers R2 will use.
// Dev/test stand-in for the R2 sink so the whole pipeline runs first-try with no cloud creds.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';

const TYPES = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
};

export function serveLocal({ dir, port = 8788, origin = '*' }) {
  const server = createServer(async (req, res) => {
    const name = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'stream.m3u8';
    const ext = extname(name);
    const root = resolve(dir);
    const file = resolve(join(dir, name));
    // Guard against path traversal (resolve normalizes separators so the prefix check is reliable).
    if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    try {
      await stat(file);
      const body = await readFile(file);
      const isPlaylist = ext === '.m3u8';
      res.writeHead(200, {
        'Content-Type': TYPES[ext] || 'application/octet-stream',
        'Access-Control-Allow-Origin': origin,
        // Playlist must be re-fetched constantly; segments/init are immutable.
        'Cache-Control': isPlaylist ? 'max-age=1' : 'public, max-age=31536000, immutable',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Access-Control-Allow-Origin': origin }).end();
    }
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}
