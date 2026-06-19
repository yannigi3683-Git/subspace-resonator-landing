import { describe, it, expect, vi } from 'vitest';
import { checkAdminAal2 } from './rtc-session';
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
