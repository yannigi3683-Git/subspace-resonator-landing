import { describe, it, expect, vi } from 'vitest';
import { checkAdminAal2, firstMid, classifyAuthError, readTokenCache, writeTokenCache, broadcastStartedAt } from './rtc-session';
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
