import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeLog } from './log.mjs';

async function withTempDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'restreamer-log-test-'));
  try { return await fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

// The stream is async, so give it a tick to flush before reading back.
const flushed = () => new Promise((r) => setTimeout(r, 50));

test('writes each line to logs/YYYY-MM-DD.log as well as the console', async () => {
  await withTempDir(async (dir) => {
    const printed = [];
    const log = makeLog({ dir, out: (...a) => printed.push(a.join(' ')), clock: () => new Date('2026-08-21T11:52:36.000Z') });

    log('GO LIVE', 'abc123', '-> starting restream');
    log('ffmpeg exited', 1, '- will restart on next poll');
    await flushed();

    assert.deepEqual(readdirSync(dir), ['2026-08-21.log']);
    const body = readFileSync(join(dir, '2026-08-21.log'), 'utf8');
    assert.match(body, /^2026-08-21T11:52:36\.000Z GO LIVE abc123 -> starting restream$/m);
    assert.match(body, /^2026-08-21T11:52:36\.000Z ffmpeg exited 1 - will restart on next poll$/m);

    // Console output is unchanged: time of day, then the message.
    assert.deepEqual(printed, [
      '11:52:36 GO LIVE abc123 -> starting restream',
      '11:52:36 ffmpeg exited 1 - will restart on next poll',
    ]);
  });
});

test('rolls to a new file when the broadcast crosses midnight', async () => {
  await withTempDir(async (dir) => {
    let at = new Date('2026-08-21T23:59:59.000Z');
    const log = makeLog({ dir, out: () => {}, clock: () => at });

    log('before midnight');
    at = new Date('2026-08-22T00:00:01.000Z');
    log('after midnight');
    await flushed();

    assert.deepEqual(readdirSync(dir).sort(), ['2026-08-21.log', '2026-08-22.log']);
  });
});

test('a log directory that cannot be written never takes the restreamer down', async () => {
  const printed = [];
  // A path under a FILE, so mkdirSync can never succeed.
  const impossible = join(import.meta.dirname, 'log.mjs', 'nope');
  const log = makeLog({ dir: impossible, out: (...a) => printed.push(a.join(' ')) });

  assert.doesNotThrow(() => log('still running'));
  assert.doesNotThrow(() => log('and still running'));
  assert.equal(printed.length, 2);
});
