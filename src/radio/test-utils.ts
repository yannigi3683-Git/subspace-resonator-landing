import { vi } from 'vitest';
import type { Station, ChatMessage } from './types';

interface FakeOpts {
  station?: Station;
  messages?: ChatMessage[];
  authUid?: string;
}

export function makeSupabaseFake(opts: FakeOpts = {}) {
  const { station = null, messages = [], authUid = 'test-uid' } = opts;

  const fakeChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockImplementation((cb?: (status: string) => void) => {
      cb?.('SUBSCRIBED');
      return fakeChannel;
    }),
    track: vi.fn().mockResolvedValue('ok'),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    presenceState: vi.fn().mockReturnValue({}),
  };

  const makeFrom = () => ({
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: station, error: null }),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: messages, error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
  });

  return {
    from: vi.fn().mockImplementation(() => makeFrom()),
    channel: vi.fn().mockReturnValue(fakeChannel),
    rpc: vi.fn().mockResolvedValue({ data: new Date().toISOString(), error: null }),
    auth: {
      signInAnonymously: vi.fn().mockResolvedValue({
        data: { user: { id: authUid }, session: { access_token: 'tok' } },
        error: null,
      }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: authUid } },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  };
}
