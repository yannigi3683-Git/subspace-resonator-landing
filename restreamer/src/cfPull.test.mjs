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

test('a burst packet arriving AFTER the next frame is dropped without rewinding the timeline', () => {
  const out = feed([1000, 1960, 2920, 1960, 3880]);
  assert.deepEqual(out, [
    { seq: 0, ts: 0 },
    { seq: 1, ts: 960 },
    { seq: 2, ts: 1920 },
    null,
    { seq: 3, ts: 2880 },
  ]);
});

test('a late real frame is dropped, the next frame lands where it belongs', () => {
  const out = feed([0, 1920, 960, 2880]);
  assert.deepEqual(out, [{ seq: 0, ts: 0 }, { seq: 1, ts: 1920 }, null, { seq: 2, ts: 2880 }]);
});

test('a 32-bit timestamp wrap is a normal 20ms step, not a drop', () => {
  const out = feed([0xfffffc40, 0, 960]);
  assert.deepEqual(out.map((o) => o.ts), [0, 960, 1920]);
});

test('a garbage forward jump still falls back to one 20ms frame', () => {
  const out = feed([1000, 1000 + 48000 * 6, 1000 + 48000 * 6 + 960]);
  assert.deepEqual(out.map((o) => o.ts), [0, 960, 1920]);
});

// Without this, a sender clock that steps back by N seconds would make every packet "older" for N
// seconds, and the deep buffer would go silent for that long. More than 1s back is a reset, not a late packet.
test('a backward clock jump of more than 1s resyncs instead of dropping everything after it', () => {
  const back = 1000 + 48000 * 10;
  const out = feed([back, back + 960, 1000, 1960]);
  assert.deepEqual(out.map((o) => o && o.ts), [0, 960, 1920, 2880]);
});
