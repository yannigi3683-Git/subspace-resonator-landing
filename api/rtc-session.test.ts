import { describe, it, expect, vi } from 'vitest';
import { checkAdminAal2 } from './rtc-session';
import type { SupabaseClient } from '@supabase/supabase-js';

// Chainable stub of the single query checkAdminAal2 runs:
//   client.from('user_roles').select('role').eq(...).eq(...).single()
function fakeClient(data: { role: string } | null): SupabaseClient {
  const single = vi.fn().mockResolvedValue({ data });
  const eq2 = vi.fn().mockReturnValue({ single });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as SupabaseClient;
}

describe('checkAdminAal2', () => {
  it('returns not_aal2 when session is not aal2 (Supabase never queried)', async () => {
    const client = fakeClient({ role: 'admin' });
    const result = await checkAdminAal2('user-1', 'aal1', client);
    expect(result).toEqual({ ok: false, reason: 'not_aal2' });
    expect((client.from as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('returns ok when aal2 and an admin role row exists', async () => {
    const result = await checkAdminAal2('user-1', 'aal2', fakeClient({ role: 'admin' }));
    expect(result).toEqual({ ok: true });
  });

  it('returns not_admin when aal2 but no admin role row', async () => {
    const result = await checkAdminAal2('user-1', 'aal2', fakeClient(null));
    expect(result).toEqual({ ok: false, reason: 'not_admin' });
  });
});
