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
