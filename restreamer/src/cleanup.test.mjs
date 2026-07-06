import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCleanup } from './cleanup.mjs';

test('releases every resource: kills ffmpeg, closes pull, stops sink, removes dir', () => {
  const calls = [];
  let removed = null;
  const cleanup = makeCleanup({
    ff: { kill: () => calls.push('kill') },
    pull: { close: () => calls.push('close') },
    sink: { stop: () => calls.push('stop') },
    outDir: '/tmp/attempt',
    existsSync: () => true,
    rmSync: (dir, opts) => { removed = { dir, opts }; calls.push('rm'); },
  });

  cleanup();

  assert.deepEqual(calls.sort(), ['close', 'kill', 'rm', 'stop']);
  assert.equal(removed.dir, '/tmp/attempt');
});

test('removes the dir with EPERM retry (Windows releases ffmpeg handles late)', () => {
  let opts = null;
  makeCleanup({
    ff: { kill() {} }, pull: { close() {} }, sink: { stop() {} },
    outDir: '/tmp/attempt',
    existsSync: () => true,
    rmSync: (_dir, o) => { opts = o; },
  })();

  assert.equal(opts.recursive, true);
  assert.ok(opts.maxRetries >= 1, 'must retry, not fail on first EPERM');
  assert.ok(opts.retryDelay > 0, 'must wait between retries');
});

test('skips rmSync when the dir is already gone', () => {
  let removed = false;
  makeCleanup({
    ff: { kill() {} }, pull: { close() {} }, sink: { stop() {} },
    outDir: '/tmp/attempt',
    existsSync: () => false,
    rmSync: () => { removed = true; },
  })();

  assert.equal(removed, false);
});

test('still closes pull and sink when ffmpeg is already dead (kill throws)', () => {
  const calls = [];
  makeCleanup({
    ff: { kill() { throw new Error('no such process'); } },
    pull: { close: () => calls.push('close') },
    sink: { stop: () => calls.push('stop') },
    outDir: '/tmp/attempt',
    existsSync: () => false,
    rmSync: () => {},
  })();

  assert.deepEqual(calls.sort(), ['close', 'stop']);
});
