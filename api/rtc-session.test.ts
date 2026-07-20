import { describe, it, expect, vi } from 'vitest';
import { checkAdminAal2, firstMid, classifyAuthError, readTokenCache, writeTokenCache } from './rtc-session';
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
