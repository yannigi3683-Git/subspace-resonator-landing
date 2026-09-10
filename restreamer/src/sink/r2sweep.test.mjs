import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sweepOldObjects, HLS_RETENTION_DAYS } from './r2sweep.mjs';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-09-10T00:00:00Z');

function fakeS3(pages) {
  const deleted = [];
  let call = 0;
  return {
    deleted,
    send: async (cmd) => {
      if (cmd.__kind === 'list') return pages[call++];
      deleted.push(...cmd.__keys);
      return { Errors: [] };
    },
  };
}
const cmds = {
  List: class { constructor(i) { this.__kind = 'list'; this.input = i; } },
  Delete: class { constructor(i) { this.__kind = 'delete'; this.__keys = i.Delete.Objects.map((o) => o.Key); } },
};

test('deletes objects past the retention window and keeps the rest', async () => {
  const s3 = fakeS3([{ Contents: [
    { Key: 'old/seg0.ts', Size: 90000, LastModified: new Date(now - 30 * DAY) },
    { Key: 'old/seg1.ts', Size: 90000, LastModified: new Date(now - 8 * DAY) },
    { Key: 'recent/seg0.ts', Size: 90000, LastModified: new Date(now - 2 * DAY) },
  ] }]);
  const res = await sweepOldObjects({ r2: { bucket: 'radio-hls' }, now, _s3: s3, _cmds: cmds });
  assert.deepEqual(s3.deleted, ['old/seg0.ts', 'old/seg1.ts']);
  assert.equal(res.deleted, 2);
});

test('never touches the broadcast that is on air right now', async () => {
  // A restreamer restarted mid-show boots into this sweep. The live prefix is minutes old, so the
  // retention window has to be the only thing protecting it - there is no "is this live?" check.
  const s3 = fakeS3([{ Contents: [
    { Key: 'live/seg99.ts', Size: 90000, LastModified: new Date(now - 60 * 1000) },
  ] }]);
  const res = await sweepOldObjects({ r2: { bucket: 'radio-hls' }, now, _s3: s3, _cmds: cmds });
  assert.deepEqual(s3.deleted, []);
  assert.equal(res.deleted, 0);
});

test('follows pagination so a big backlog is fully reclaimed', async () => {
  const s3 = fakeS3([
    { Contents: [{ Key: 'a/0.ts', Size: 1, LastModified: new Date(now - 90 * DAY) }], IsTruncated: true, NextContinuationToken: 'c1' },
    { Contents: [{ Key: 'b/0.ts', Size: 1, LastModified: new Date(now - 90 * DAY) }] },
  ]);
  await sweepOldObjects({ r2: { bucket: 'radio-hls' }, now, _s3: s3, _cmds: cmds });
  assert.deepEqual(s3.deleted, ['a/0.ts', 'b/0.ts']);
});

test('a sweep failure is reported, never thrown at the caller', async () => {
  // This runs on the boot that precedes a broadcast. Housekeeping must never be able to stop a
  // show from starting.
  const s3 = { send: async () => { throw new Error('AccessDenied'); } };
  const res = await sweepOldObjects({ r2: { bucket: 'radio-hls' }, now, _s3: s3, _cmds: cmds });
  assert.equal(res.deleted, 0);
  assert.match(res.error, /AccessDenied/);
});

test('retention is 7 days', () => assert.equal(HLS_RETENTION_DAYS, 7));
