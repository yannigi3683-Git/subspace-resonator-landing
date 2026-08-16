// Live self-check: proves the output spine end-to-end with NO cloud creds and NO live broadcast.
// Generates a continuous tone as a stand-in for the pulled Opus, runs the REAL hls.mjs muxer and
// the REAL local sink, then over HTTP verifies: (1) playlist served with correct headers,
// (2) media sequence ADVANCES (stream is live/rolling, not a dead VOD), (3) a fetched
// init+segment decodes cleanly. Any failed assert exits non-zero.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { startHls } from './hls.mjs';
import { serveLocal } from './sink/local.mjs';

// Resolved via PATH, not from .env: this check must run on a fresh machine (the "did the move to
// another PC work" test) where .env may not be edited yet. Absolute fallbacks here were one host's
// paths, so the check failed on every other machine for a reason unrelated to what it tests.
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const dir = mkdtempSync(join(tmpdir(), 'restreamer-selfcheck-'));
log('work dir', dir);

// Endless 440Hz tone, paced real-time (-re), stands in for the pulled live audio.
const ff = startHls({
  ffmpegPath: FFMPEG,
  inputArgs: ['-re', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000'],
  outDir: dir,
  segmentSeconds: 2, // short segs so the check runs fast
  window: 5,
});
ff.on('exit', (c) => log('ffmpeg exited', c));

const server = await serveLocal({ dir, port: PORT });
log('sink serving on', BASE);

function lastSeg(m3u8) {
  const segs = [...m3u8.matchAll(/stream(\d+)\.ts/g)].map((m) => Number(m[1]));
  return segs.length ? Math.max(...segs) : -1;
}

try {
  // Wait for the first segments to land.
  let playlist = '';
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${BASE}/stream.m3u8`).catch(() => null);
    if (r?.ok) {
      playlist = await r.text();
      if (/\.ts/.test(playlist)) break;
    }
    await sleep(1000);
  }
  log('playlist:\n' + playlist.trim());
  assert.match(playlist, /#EXTM3U/, 'not a valid HLS playlist');
  assert.match(playlist, /\.ts/, 'no media segments');
  assert.doesNotMatch(playlist, /#EXT-X-ENDLIST/, 'stream is dead (has ENDLIST) — should be live');

  // Headers: playlist must be max-age=1 + CORS.
  const head = await fetch(`${BASE}/stream.m3u8`);
  assert.equal(head.headers.get('access-control-allow-origin'), '*', 'no CORS on playlist');
  assert.equal(head.headers.get('cache-control'), 'max-age=1', 'wrong playlist cache header');
  log('OK: headers correct (CORS + max-age=1)');

  // Liveness: new segments must keep being produced (stream is live, not a dead capture).
  const seg1 = lastSeg(playlist);
  await sleep(5000);
  const seg2 = lastSeg(await (await fetch(`${BASE}/stream.m3u8`)).text());
  log(`newest segment #${seg1} -> #${seg2}`);
  assert.ok(seg2 > seg1, 'no new segments produced — stream not live');
  log('OK: stream is live (new segments flowing)');

  // Fetch one mpegts segment over HTTP and decode-test it (self-contained, no init needed).
  const pl = await (await fetch(`${BASE}/stream.m3u8`)).text();
  // Oldest listed segment is fully written (newest may still be flushing).
  const seg = pl.split('\n').find((l) => l.trim().endsWith('.ts')).trim();
  const segHead = await fetch(`${BASE}/${seg}`);
  assert.match(segHead.headers.get('cache-control') || '', /immutable/, 'segment not immutable-cached');
  const segBuf = Buffer.from(await (await fetch(`${BASE}/${seg}`)).arrayBuffer());
  const probeFile = join(dir, '_probe.ts');
  await writeFile(probeFile, segBuf);
  const decode = await new Promise((res) => {
    const p = spawn(FFMPEG, ['-hide_banner', '-v', 'error', '-i', probeFile, '-f', 'null', '-'], { stdio: 'inherit' });
    p.on('exit', res);
  });
  assert.equal(decode, 0, 'fetched HLS segment failed to decode');
  log('OK: fetched-over-HTTP segment decodes clean');

  const meta = await new Promise((res) => {
    let out = '';
    const p = spawn(FFPROBE, ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels', '-of', 'default=noprint_wrappers=1', probeFile]);
    p.stdout.on('data', (d) => (out += d));
    p.on('exit', () => res(out.trim()));
  });
  log('segment codec:', meta.replace(/\s+/g, ' '));
  assert.match(meta, /codec_name=aac/);
  assert.match(meta, /sample_rate=48000/);
  assert.match(meta, /channels=2/);

  log('\n=== SELF-CHECK GREEN: output spine (mux -> serve -> fetch -> decode) works live ===');
  process.exitCode = 0;
} catch (e) {
  log('SELF-CHECK FAILED:', e.message);
  process.exitCode = 1;
} finally {
  ff.kill('SIGKILL');
  server.close();
  await sleep(200);
}
