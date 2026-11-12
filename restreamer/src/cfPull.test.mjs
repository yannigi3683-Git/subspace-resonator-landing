import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRestamper } from './cfPull.mjs';

const feed = (stamps) => {
  const restamp = makeRestamper();
  return stamps.map((ts) => restamp(ts));
};

test('steady 20ms frames pass through with monotonic seq and ts', () => {
  const out = feed([1000, 1960, 2920]);
  assert.deepEqual(out, [{ seq: 0, ts: 0 }, { seq: 1, ts: 960 }, { seq: 2, ts: 1920 }]);
});

// Measured live 2026-11-12: every 5.0s the host's Chrome 157 sends a burst of 3-4 small packets
// (50-74 bytes) carrying the SAME timestamp as the frame before. Treating dts=0 as a 20ms frame
// spliced ~80ms of junk into the HLS stream every 5 seconds, heard as a bump.
test('a same-timestamp burst is dropped and the timeline stays continuous', () => {
  const out = feed([1000, 1960, 1960, 1960, 1960, 2920]);
  assert.deepEqual(out, [
    { seq: 0, ts: 0 },
    { seq: 1, ts: 960 },
    null,
    null,
    null,
    { seq: 2, ts: 1920 },
  ]);
});

test('a backwards or garbage jump still falls back to one 20ms frame', () => {
  const out = feed([100000, 99040, 100000 + 48000 * 6]);
  assert.deepEqual(out.map((o) => o.ts), [0, 960, 1920]);
});
