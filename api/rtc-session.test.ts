import { describe, it, expect, vi } from 'vitest';
import { checkAdminAal2, findBan, firstMid, classifyAuthError, readTokenCache, writeTokenCache, broadcastStartedAt, parseExpect, expectHolds, writeStation } from './rtc-session';
import type { SupabaseClient } from '@supabase/supabase-js';

// checkAdminAal2 reads the role through the security-definer has_role() RPC, which
// bypasses RLS regardless of the key type. Stub .rpc() to return the desired result.
function fakeClient(rpcResult: { data: unknown; error: unknown }): SupabaseClient {
  return { rpc: vi.fn().mockResolvedValue(rpcResult) } as unknown as SupabaseClient;
}

describe('checkAdminAal2', () => {
  it('returns not_aal2 when session is not aal2 (RPC never called)', async () => {
    const client = fakeClient({ data: true, error: null });
    const result = await checkAdminAal2('user-1', 'aal1', client);
    expect(result).toEqual({ ok: false, reason: 'not_aal2' });
    expect((client.rpc as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('returns ok when aal2 and has_role RPC returns true', async () => {
    const result = await checkAdminAal2('user-1', 'aal2', fakeClient({ data: true, error: null }));
    expect(result).toEqual({ ok: true });
  });

  it('returns not_admin when aal2 but has_role RPC returns false', async () => {
    const result = await checkAdminAal2('user-1', 'aal2', fakeClient({ data: false, error: null }));
    expect(result).toEqual({ ok: false, reason: 'not_admin' });
  });

  it('returns not_admin when aal2 but the RPC errors', async () => {
    const result = await checkAdminAal2('user-1', 'aal2', fakeClient({ data: null, error: { message: 'boom' } }));
    expect(result).toEqual({ ok: false, reason: 'not_admin' });
  });

  it('calls has_role with the user id and admin role', async () => {
    const client = fakeClient({ data: true, error: null });
    await checkAdminAal2('user-xyz', 'aal2', client);
    expect(client.rpc).toHaveBeenCalledWith('has_role', { _user_id: 'user-xyz', _role: 'admin' });
  });
});

// Minimal stand-in for the PostgREST builder: records which column each lookup filtered on
// and replays a canned result per column.
function fakeBansClient(rows: { uid?: unknown[]; device_id?: unknown[] }) {
  const filtered: string[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: (column: string) => {
          filtered.push(column);
          return { limit: () => Promise.resolve({ data: rows[column as 'uid' | 'device_id'] ?? [] }) };
        },
      }),
    }),
  } as unknown as SupabaseClient;
  return { client, filtered };
}

describe('findBan', () => {
  it('finds a ban by uid without needing a device id', async () => {
    const { client } = fakeBansClient({ uid: [{ uid: 'u1' }] });
    expect(await findBan('u1', null, client)).toBe(true);
  });

  it('finds a ban by device id when the uid is clean (anon re-auth mints a new uid)', async () => {
    const { client } = fakeBansClient({ device_id: [{ uid: 'old-uid' }] });
    expect(await findBan('fresh-uid', 'device-1', client)).toBe(true);
  });

  it('returns false when neither matches', async () => {
    const { client } = fakeBansClient({});
    expect(await findBan('u1', 'device-1', client)).toBe(false);
  });

  it('skips the device lookup entirely when no device id is supplied', async () => {
    const { client, filtered } = fakeBansClient({});
    expect(await findBan('u1', null, client)).toBe(false);
    expect(filtered).toEqual(['uid']);
  });

  it('short-circuits on a uid hit without a second query', async () => {
    const { client, filtered } = fakeBansClient({ uid: [{ uid: 'u1' }] });
    await findBan('u1', 'device-1', client);
    expect(filtered).toEqual(['uid']);
  });
});

describe('classifyAuthError', () => {
  it('maps a 429 status to rate_limited', () => {
    expect(classifyAuthError({ status: 429, message: 'nope' })).toBe('rate_limited');
  });

  it('maps a "rate limit" message to rate_limited (any status)', () => {
    expect(classifyAuthError({ status: 400, message: 'Request rate limit reached' })).toBe('rate_limited');
  });

  it('maps everything else to invalid_token', () => {
    expect(classifyAuthError({ status: 401, message: 'bad jwt' })).toBe('invalid_token');
    expect(classifyAuthError(null)).toBe('invalid_token');
  });
});

describe('token cache', () => {
  it('returns a hit within the TTL and a miss after it expires', () => {
    const token = `tok-${Math.random()}`;
    const t0 = 1_000_000;
    writeTokenCache(token, 'user-1', 'aal1', t0);
    expect(readTokenCache(token, t0 + 30_000)).toEqual({ userId: 'user-1', aal: 'aal1' });
    expect(readTokenCache(token, t0 + 60_001)).toBeNull();
  });

  it('returns null for a token never cached', () => {
    expect(readTokenCache(`missing-${Math.random()}`)).toBeNull();
  });
});

// Regression guard for the 2026-07-26 incident: a host network drop re-published mid-show and
// stamped a fresh startedAt, which hid the whole broadcast's chat (RLS chat_visible floors on it)
// and kicked every listener back to the entry gate.
describe('broadcastStartedAt', () => {
  const NOW = '2026-07-26T15:00:00.000Z';
  const SHOW_START = '2026-07-26T12:43:00.000Z';

  it('carries startedAt forward when a live broadcast re-publishes (reconnect)', () => {
    const prev = { mode: 'live', live_session: { cfSessionId: 'old-cf', startedAt: SHOW_START } };
    expect(broadcastStartedAt(prev, NOW)).toBe(SHOW_START);
  });

  it('stamps a new startedAt on a go-live from off-air', () => {
    expect(broadcastStartedAt({ mode: 'off', live_session: null }, NOW)).toBe(NOW);
  });

  it('stamps a new startedAt when there is no station row at all', () => {
    expect(broadcastStartedAt(null, NOW)).toBe(NOW);
  });

  it('stamps a new startedAt when a live row somehow has no startedAt', () => {
    const prev = { mode: 'live', live_session: { cfSessionId: 'cf' } };
    expect(broadcastStartedAt(prev, NOW)).toBe(NOW);
  });

  it('does not resurrect startedAt from a stale live_session left on an off-air station', () => {
    const prev = { mode: 'off', live_session: { cfSessionId: 'cf', startedAt: SHOW_START } };
    expect(broadcastStartedAt(prev, NOW)).toBe(NOW);
  });
});

describe('firstMid', () => {
  it('extracts the numeric mid from a typical offer', () => {
    const sdp = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\n';
    expect(firstMid(sdp)).toBe('0');
  });

  it('extracts a named mid', () => {
    const sdp = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:audio\r\n';
    expect(firstMid(sdp)).toBe('audio');
  });

  it('defaults to "0" when no mid line is present', () => {
    expect(firstMid('v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n')).toBe('0');
  });
});

// SCHEDULE RUNNER (Release 2, task 1b): an optional "only if" on going live and ending, so an
// automatic show can never take over or end a show someone else started. The broadcast id is
// live_session.startedAt, which a host reconnect keeps (spec cycle A9.1).
describe('parseExpect', () => {
  it('is none when absent, so manual GO LIVE and END are untouched', () => {
    expect(parseExpect(undefined)).toEqual({ kind: 'none' });
    expect(parseExpect(null)).toEqual({ kind: 'none' });
  });
  it('reads off and a broadcast id', () => {
    expect(parseExpect('off')).toEqual({ kind: 'off' });
    expect(parseExpect('2026-11-28T20:00:00.000Z')).toEqual({ kind: 'broadcast', startedAt: '2026-11-28T20:00:00.000Z' });
  });
  it('rejects anything else instead of guessing', () => {
    for (const bad of ['', 42, {}, [], true, 'x'.repeat(41)]) expect(parseExpect(bad)).toBeNull();
  });
});

describe('expectHolds', () => {
  const ID = '2026-11-28T20:00:00.000Z';
  const live = (startedAt?: string) => ({ mode: 'live', live_session: { cfSessionId: 'cf2', startedAt } });
  it('always holds without a condition', () => {
    expect(expectHolds({ kind: 'none' }, null)).toBe(true);
  });
  it('off holds only on an off-air station, and not when the row could not be read', () => {
    expect(expectHolds({ kind: 'off' }, { mode: 'off', live_session: null })).toBe(true);
    expect(expectHolds({ kind: 'off' }, live(ID))).toBe(false);
    expect(expectHolds({ kind: 'off' }, null)).toBe(false);
  });
  it('a broadcast id holds only while that broadcast is live, whatever its cfSessionId', () => {
    expect(expectHolds({ kind: 'broadcast', startedAt: ID }, live(ID))).toBe(true);
    expect(expectHolds({ kind: 'broadcast', startedAt: ID }, live('2026-11-28T21:00:00.000Z'))).toBe(false);
    expect(expectHolds({ kind: 'broadcast', startedAt: ID }, live(undefined))).toBe(false);
    expect(expectHolds({ kind: 'broadcast', startedAt: ID }, { mode: 'off', live_session: { startedAt: ID } })).toBe(false);
    expect(expectHolds({ kind: 'broadcast', startedAt: ID }, null)).toBe(false);
  });
});

// Records every builder call and answers the awaited query with a canned result.
function fakeStationClient(result: { data?: unknown; error: unknown }) {
  const calls: unknown[][] = [];
  const builder: Record<string, unknown> = {};
  for (const m of ['update', 'eq', 'select']) {
    builder[m] = (...args: unknown[]) => { calls.push([m, ...args]); return builder; };
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  const client = { from: (t: string) => { calls.push(['from', t]); return builder; } } as unknown as SupabaseClient;
  return { client, calls };
}

describe('writeStation', () => {
  const patch = { mode: 'live', live_title: 'T', live_session: { cfSessionId: 'cf', startedAt: 'S' } };
  const ID = '2026-11-28T20:00:00.000Z';

  it('without a condition makes exactly the write it always made (regression lock)', async () => {
    const { client, calls } = fakeStationClient({ error: null });
    expect(await writeStation(client, patch, { kind: 'none' })).toEqual({ error: null, busy: false });
    expect(calls).toEqual([['from', 'station'], ['update', patch], ['eq', 'id', true]]);
  });
  it('without a condition passes a write error through', async () => {
    const { client } = fakeStationClient({ error: { message: 'rls' } });
    expect(await writeStation(client, patch, { kind: 'none' })).toEqual({ error: { message: 'rls' }, busy: false });
  });
  it('off adds mode = off to the same update and asks for the row back', async () => {
    const { client, calls } = fakeStationClient({ data: [{ id: true }], error: null });
    expect(await writeStation(client, patch, { kind: 'off' })).toEqual({ error: null, busy: false });
    expect(calls).toEqual([['from', 'station'], ['update', patch], ['eq', 'id', true], ['eq', 'mode', 'off'], ['select', 'id']]);
  });
  it('a broadcast id matches on live and startedAt, never on cfSessionId', async () => {
    const { client, calls } = fakeStationClient({ data: [{ id: true }], error: null });
    await writeStation(client, { mode: 'off', live_session: null }, { kind: 'broadcast', startedAt: ID });
    expect(calls.slice(3)).toEqual([['eq', 'mode', 'live'], ['eq', 'live_session->>startedAt', ID], ['select', 'id']]);
  });
  it('zero rows back means the condition failed: busy, not success', async () => {
    const { client } = fakeStationClient({ data: [], error: null });
    expect(await writeStation(client, patch, { kind: 'off' })).toEqual({ error: null, busy: true });
    const { client: c2 } = fakeStationClient({ data: null, error: null });
    expect(await writeStation(c2, patch, { kind: 'off' })).toEqual({ error: null, busy: true });
  });
  it('a conditional write error is an error, not busy', async () => {
    const { client } = fakeStationClient({ data: null, error: { message: 'boom' } });
    expect(await writeStation(client, patch, { kind: 'off' })).toEqual({ error: { message: 'boom' }, busy: false });
  });
});
