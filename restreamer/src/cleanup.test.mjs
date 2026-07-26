import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basename } from 'node:path';
import { makeCleanup, sweepStaleTempDirs, STALE_DIR_MS } from './cleanup.mjs';

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

// Regression guard: ffmpeg runs with cwd=outDir and Windows refuses to delete a live process's
// cwd, so rmSync throws EPERM. That used to propagate and REPLACE the caller's real error
// ("no HLS segments produced within timeout"), so the log blamed the wrong thing and the
// restreamer sat dead until the next id change (2026-07-26 incident).
test('swallows an EPERM from rmSync instead of masking the caller\'s real error', () => {
  const logged = [];
  const cleanup = makeCleanup({
    ff: { kill() {} }, pull: { close() {} }, sink: { stop() {} },
    outDir: '/tmp/attempt',
    existsSync: () => true,
    rmSync: () => { throw Object.assign(new Error('EPERM, Permission denied'), { code: 'EPERM' }); },
    log: (...a) => logged.push(a.join(' ')),
  });

  assert.doesNotThrow(cleanup);
  assert.ok(logged.some((l) => l.includes('/tmp/attempt')), 'the leftover dir must still be logged');
});

test('releases ffmpeg, pull and sink even when rmSync throws', () => {
  const calls = [];
  makeCleanup({
    ff: { kill: () => calls.push('kill') },
    pull: { close: () => calls.push('close') },
    sink: { stop: () => calls.push('stop') },
    outDir: '/tmp/attempt',
    existsSync: () => true,
    rmSync: () => { throw new Error('EPERM'); },
  })();

  assert.deepEqual(calls.sort(), ['close', 'kill', 'stop']);
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

// The boot sweep reclaims dirs a previous run leaked. It must NOT touch a dir that is still being
// written: start-restreamer.bat is double-clickable, and a second launch that deleted the running
// show's segments would take the live stream down.
const NOW = 1_800_000_000_000;

function fakeFs(entries) {
  const removed = [];
  return {
    removed,
    now: NOW,
    tmpdir: () => '/tmp',
    readdir: async () => Object.keys(entries),
    stat: async (dir) => {
      const name = basename(dir);
      if (!(name in entries)) throw new Error('ENOENT');
      return { mtimeMs: entries[name] };
    },
    rmSync: (dir) => removed.push(basename(dir)),
  };
}

test('sweep removes an idle leftover temp dir', async () => {
  const fs = fakeFs({ 'restreamer-old': NOW - STALE_DIR_MS - 1 });
  assert.equal(await sweepStaleTempDirs(fs), 1);
  assert.deepEqual(fs.removed, ['restreamer-old']);
});

test('sweep NEVER removes a dir a running show is still writing', async () => {
  const fs = fakeFs({ 'restreamer-live': NOW - 5_000 });
  assert.equal(await sweepStaleTempDirs(fs), 0);
  assert.deepEqual(fs.removed, [], 'a second launch must not kill the live show');
});

test('sweep ignores directories that are not ours', async () => {
  const fs = fakeFs({ 'npm-cache-xyz': NOW - STALE_DIR_MS - 1, 'restreamer-old': NOW - STALE_DIR_MS - 1 });
  await sweepStaleTempDirs(fs);
  assert.deepEqual(fs.removed, ['restreamer-old']);
});

test('sweep survives an unreadable tmpdir and a dir that vanishes mid-scan', async () => {
  assert.equal(await sweepStaleTempDirs({ ...fakeFs({}), readdir: async () => { throw new Error('EACCES'); } }), 0);

  const fs = fakeFs({ 'restreamer-gone': NOW - STALE_DIR_MS - 1, 'restreamer-old': NOW - STALE_DIR_MS - 1 });
  const realStat = fs.stat;
  fs.stat = async (dir) => (dir.includes('gone') ? Promise.reject(new Error('ENOENT')) : realStat(dir));
  assert.equal(await sweepStaleTempDirs(fs), 1);
  assert.deepEqual(fs.removed, ['restreamer-old']);
});
