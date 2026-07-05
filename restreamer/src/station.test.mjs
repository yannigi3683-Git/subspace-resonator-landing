import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAction, hasStaleStreamUrl } from './station.mjs';

const live = (id) => ({ mode: 'live', live_session: { cfSessionId: id } });
const off = { mode: 'off', live_session: null };

test('start when a live broadcast appears and nothing is running', () => {
  assert.deepEqual(decideAction(null, live('A')), { action: 'start', cfSessionId: 'A' });
});

test('none when already restreaming the same broadcast', () => {
  assert.deepEqual(decideAction('A', live('A')), { action: 'none' });
});

test('restart when the broadcast id changes mid-flight', () => {
  assert.deepEqual(decideAction('A', live('B')), { action: 'restart', cfSessionId: 'B' });
});

test('stop when the station goes off-air', () => {
  assert.deepEqual(decideAction('A', off), { action: 'stop' });
});

test('none when off-air and nothing running', () => {
  assert.deepEqual(decideAction(null, off), { action: 'none' });
});

test('off-air treated as stop when live_session lingers but mode is off', () => {
  assert.deepEqual(decideAction('A', { mode: 'off', live_session: { cfSessionId: 'A' } }), { action: 'stop' });
});

test('missing/garbage station row is safe (no crash, stop if running)', () => {
  assert.deepEqual(decideAction('A', null), { action: 'stop' });
  assert.deepEqual(decideAction(null, undefined), { action: 'none' });
  assert.deepEqual(decideAction(null, { mode: 'live', live_session: null }), { action: 'none' });
});

test('hasStaleStreamUrl: off-air with a lingering streamUrl is stale', () => {
  assert.equal(hasStaleStreamUrl({ mode: 'off', live_session: { streamUrl: 'http://x/s.m3u8' } }), true);
});

test('hasStaleStreamUrl: live with a streamUrl is NOT stale (startFor overwrites it)', () => {
  assert.equal(hasStaleStreamUrl({ mode: 'live', live_session: { cfSessionId: 'A', streamUrl: 'http://x/s.m3u8' } }), false);
});

test('hasStaleStreamUrl: no streamUrl / garbage is never stale', () => {
  assert.equal(hasStaleStreamUrl({ mode: 'off', live_session: null }), false);
  assert.equal(hasStaleStreamUrl(null), false);
  assert.equal(hasStaleStreamUrl(undefined), false);
});
