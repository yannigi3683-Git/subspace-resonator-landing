import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seedPlaylist } from './hls.mjs';

const LIVE = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXT-X-MEDIA-SEQUENCE:210\n#EXTINF:4.0,\nstream210.ts\n#EXTINF:4.0,\nstream211.ts\n';
const reply = (status, body = '') => async () => ({ ok: status === 200, status, text: async () => body });
const dir = () => mkdtempSync(join(tmpdir(), 'seed-test-'));

// 2026-11-12: a mid-show restart renumbered from stream0.ts, and phones replayed their immutable
// cached copies, ~20 min back in the set. Seeding the live playlist lets append_list continue.
test('an existing playlist is written into the work dir so ffmpeg continues numbering', async () => {
  const outDir = dir();
  const r = await seedPlaylist({ url: 'https://x/p/stream.m3u8', outDir, fetchImpl: reply(200, LIVE) });
  assert.equal(r, 'stream211.ts');
  assert.equal(readFileSync(join(outDir, 'stream.m3u8'), 'utf8'), LIVE);
});

test('a new show (no playlist yet) starts fresh', async () => {
  const outDir = dir();
  assert.equal(await seedPlaylist({ url: 'https://x/p/stream.m3u8', outDir, fetchImpl: reply(404) }), null);
  assert.equal(existsSync(join(outDir, 'stream.m3u8')), false);
});

test('a body that is not a playlist with segments is ignored', async () => {
  const outDir = dir();
  assert.equal(await seedPlaylist({ url: 'u', outDir, fetchImpl: reply(200, '<html>error</html>') }), null);
  assert.equal(await seedPlaylist({ url: 'u', outDir, fetchImpl: reply(200, '#EXTM3U\n#EXT-X-VERSION:3\n') }), null);
  assert.equal(existsSync(join(outDir, 'stream.m3u8')), false);
});

test('a network failure never blocks the restream; it starts fresh and says so', async () => {
  const outDir = dir();
  const lines = [];
  const r = await seedPlaylist({
    url: 'u', outDir, log: (...a) => lines.push(a.join(' ')),
    fetchImpl: async () => { throw new Error('ECONNRESET'); },
  });
  assert.equal(r, null);
  assert.match(lines.join('\n'), /ECONNRESET/);
});

test('the fetch bypasses caches so a restart never resumes from a stale copy', async () => {
  let seen;
  await seedPlaylist({ url: 'https://x/p/stream.m3u8', outDir: dir(), fetchImpl: async (u, o) => { seen = { u, o }; return { ok: false, status: 404 }; } });
  assert.match(seen.u, /^https:\/\/x\/p\/stream\.m3u8\?cb=\d+$/);
  assert.equal(seen.o.cache, 'no-store');
});
