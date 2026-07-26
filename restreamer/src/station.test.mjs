import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideAction, hasStaleStreamUrl, setStreamUrl } from './station.mjs';

// Minimal PostgREST shape: .from().select().eq().single() to read, .from().update().eq() to write.
function fakeSupabase(station) {
  const writes = [];
  return {
    writes,
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: station, error: null }) }) }),
      update: (patch) => ({ eq: async () => { writes.push(patch); return { error: null }; } }),
    }),
  };
}

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

// setStreamUrl is a read-modify-write of the whole live_session jsonb with the service-role key.
// If the host re-published between the read and the write it would revert live_session to a dead
// cfSessionId, flapping every listener a second time.
test('setStreamUrl writes when the session still matches', async () => {
  const s = fakeSupabase({ mode: 'live', live_session: { cfSessionId: 'A', startedAt: 'T0' } });
  await setStreamUrl(s, 'http://x/s.m3u8', 'A');
  assert.equal(s.writes.length, 1);
  assert.deepEqual(s.writes[0].live_session, { cfSessionId: 'A', startedAt: 'T0', streamUrl: 'http://x/s.m3u8' });
});

test('setStreamUrl does NOT clobber live_session when the host has re-published', async () => {
  const s = fakeSupabase({ mode: 'live', live_session: { cfSessionId: 'B', startedAt: 'T0' } });
  await setStreamUrl(s, 'http://x/s.m3u8', 'A');
  assert.equal(s.writes.length, 0, 'must not write a streamUrl for a session that is gone');
});

test('setStreamUrl clearing is also session-guarded', async () => {
  const s = fakeSupabase({ mode: 'live', live_session: { cfSessionId: 'B', streamUrl: 'http://x/s.m3u8' } });
  await setStreamUrl(s, null, 'A');
  assert.equal(s.writes.length, 0);
});

test('setStreamUrl without a session id stays unconditional (boot clear)', async () => {
  const s = fakeSupabase({ mode: 'live', live_session: { cfSessionId: 'B', streamUrl: 'http://x/s.m3u8' } });
  await setStreamUrl(s, null);
  assert.equal(s.writes.length, 1);
  assert.deepEqual(s.writes[0].live_session, { cfSessionId: 'B' });
});

test('setStreamUrl is a no-op when the station has no live_session', async () => {
  const s = fakeSupabase({ mode: 'off', live_session: null });
  await setStreamUrl(s, 'http://x/s.m3u8', 'A');
  assert.equal(s.writes.length, 0);
});
