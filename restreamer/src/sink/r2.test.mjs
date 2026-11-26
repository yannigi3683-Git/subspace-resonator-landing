import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startR2Sink } from './r2.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Regression guard for the ECONNRESET storm: scans must never overlap. We compress the 1s reschedule
// to ~2ms and make each S3 upload slow (25ms), so if the loop ever fired a new scan before the
// previous one settled, two uploads would be in flight at once. Serialized code keeps it at 1.
test('scans never overlap even when uploads are slow (no ECONNRESET pileup)', async () => {
  let active = 0;
  let maxActive = 0;
  let scanCount = 0;
  let size = 0;

  const sink = await startR2Sink({
    outDir: '/fake',
    r2: { bucket: 'b' },
    publicBaseUrl: 'https://cdn',
    prefix: 'sess',
    _s3: {
      async send() {
        active++;
        maxActive = Math.max(maxActive, active);
        await sleep(25);
        active--;
      },
    },
    _readdir: async () => { scanCount++; return ['seg0.ts', 'stream.m3u8']; },
    _stat: async () => ({ size: size++ }),   // ever-changing size => every scan re-uploads
    _readFile: async () => Buffer.from('x'),
    _setTimeout: (fn) => setTimeout(fn, 2),  // shrink the 1s gap so many scans run fast
  });

  await sleep(250);
  sink.stop();
  await sleep(60); // let the in-flight scan drain after stop()

  assert.equal(maxActive, 1, `two scans ran at once (max=${maxActive}) — pileup regression`);
  assert.ok(scanCount > 3, `expected several scans, got ${scanCount}`);
});

test('one failed upload does not abort the scan (playlist still gets pushed)', async () => {
  const puts = [];
  const sink = await startR2Sink({
    outDir: '/fake',
    r2: { bucket: 'b' },
    publicBaseUrl: 'https://cdn',
    prefix: 'sess',
    _s3: {
      async send(cmd) {
        const key = cmd?.input?.Key || '';
        puts.push(key);
        if (key.endsWith('seg0.ts')) throw new Error('socket hang up'); // ECONNRESET-style
      },
    },
    _readdir: async () => ['seg0.ts', 'stream.m3u8'],
    _stat: async () => ({ size: 1 }),
    _readFile: async () => Buffer.from('x'),
    _setTimeout: (fn) => setTimeout(fn, 2),
  });

  await sleep(40);
  sink.stop();

  assert.ok(puts.some((k) => k.endsWith('stream.m3u8')), 'playlist must still upload after a segment fails');
});

// streamUrl is published when sink.live resolves. It used to go out as soon as ffmpeg opened its
// first .ts, ~4-6s before any playlist existed in R2, and hls.js never retries a 404 manifest.
const fakeSink = (files, bodies) => startR2Sink({
  outDir: '/fake',
  r2: { bucket: 'b' },
  publicBaseUrl: 'https://cdn',
  prefix: 'sess',
  _s3: { async send() {} },
  _readdir: async () => files(),
  _stat: async (p) => ({ size: (bodies[p.split(/[\\/]/).pop()] ?? 'x').length }),
  _readFile: async (p) => Buffer.from(bodies[p.split(/[\\/]/).pop()] ?? 'x'),
  _setTimeout: (fn) => setTimeout(fn, 2),
});
const settled = (p, ms = 40) => Promise.race([p.then(() => true), sleep(ms).then(() => false)]);

test('listsUploadedSegment only counts segment lines this run uploaded', async () => {
  const { listsUploadedSegment } = await import('./r2.mjs');
  const pl = '#EXTM3U\n#EXT-X-TARGETDURATION:4\n#EXTINF:4.0,\nstream7.ts\r\n';
  assert.equal(listsUploadedSegment(pl, new Map([['stream7.ts', 10]])), true);
  assert.equal(listsUploadedSegment(pl, new Map([['stream6.ts', 10]])), false);
  assert.equal(listsUploadedSegment('#EXTM3U\n', new Map([['stream7.ts', 10]])), false);
});

test('not live while ffmpeg has only started a segment and no playlist exists', async () => {
  const sink = await fakeSink(() => ['stream0.ts'], {});
  assert.equal(await settled(sink.live), false);
  sink.stop();
});

test('live once a playlist listing an uploaded segment has been uploaded', async () => {
  const sink = await fakeSink(() => ['stream0.ts', 'stream.m3u8'], { 'stream.m3u8': '#EXTM3U\n#EXTINF:4.0,\nstream0.ts\n' });
  assert.equal(await settled(sink.live, 200), true);
  sink.stop();
});

test('a playlist seeded from R2 on a mid-show restart does not count as live', async () => {
  // Seeded playlist lists stream210.ts, which lives in R2, not in this run's work dir.
  let files = ['stream.m3u8'];
  const bodies = { 'stream.m3u8': '#EXTM3U\n#EXTINF:4.0,\nstream210.ts\n' };
  const sink = await fakeSink(() => files, bodies);
  assert.equal(await settled(sink.live), false);
  // ffmpeg closes its first new segment and appends it to the playlist.
  files = ['stream211.ts', 'stream.m3u8'];
  bodies['stream.m3u8'] += '#EXT-X-DISCONTINUITY\n#EXTINF:4.0,\nstream211.ts\n';
  assert.equal(await settled(sink.live, 200), true);
  sink.stop();
});
