import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useChat } from './useChat';
import type { ChatMessage, Identity } from '../types';

const identity: Identity = {
  name: 'Yanni',
  avatarId: 'nebula',
  deviceId: 'dev-1',
  position: { x: 10, y: 20 },
};

const makeMsg = (id: string): ChatMessage => ({
  id,
  uid: 'uid-1',
  display_name: 'Alice',
  avatar_id: 'nebula',
  body: `body ${id}`,
  is_host: false,
  created_at: '2026-07-25T20:00:00Z',
});

type Handler = (payload: { new?: unknown; old?: unknown }) => void;

// Captures the postgres_changes handlers so a realtime event can be replayed by hand.
function fakeSupabase(initial: ChatMessage[]) {
  const handlers: Record<string, Handler> = {};
  const insert = vi.fn().mockResolvedValue({ error: null });
  const channel = {
    on: vi.fn().mockImplementation((_type: string, filter: { event: string }, cb: Handler) => {
      handlers[filter.event] = cb;
      return channel;
    }),
    subscribe: vi.fn().mockReturnThis(),
  };
  const supabase = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [...initial].reverse() }),
      insert,
    }),
    channel: vi.fn().mockReturnValue(channel),
    removeChannel: vi.fn(),
  } as unknown as SupabaseClient;
  return { supabase, handlers, insert };
}

describe('useChat', () => {
  it('drops a message the host deleted, without a reload', async () => {
    const { supabase, handlers } = fakeSupabase([makeMsg('a'), makeMsg('b')]);
    const { result } = renderHook(() => useChat(supabase, identity, 'uid-me'));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    act(() => handlers.DELETE({ old: { id: 'a' } }));

    expect(result.current.messages.map((m) => m.id)).toEqual(['b']);
  });

  it('ignores a delete event with no id rather than clearing the room', async () => {
    const { supabase, handlers } = fakeSupabase([makeMsg('a')]);
    const { result } = renderHook(() => useChat(supabase, identity, 'uid-me'));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    act(() => handlers.DELETE({ old: null }));

    expect(result.current.messages).toHaveLength(1);
  });

  it('still appends inserts', async () => {
    const { supabase, handlers } = fakeSupabase([]);
    const { result } = renderHook(() => useChat(supabase, identity, 'uid-me'));
    await waitFor(() => expect(result.current.messages).toHaveLength(0));

    act(() => handlers.INSERT({ new: makeMsg('c') }));

    expect(result.current.messages.map((m) => m.id)).toEqual(['c']);
  });

  // The host moderates from inside the room and blends in, so his own messages must go out
  // as ordinary listener messages. chat_allowed() permits this for an admin.
  it('sends messages as a normal listener (is_host false)', async () => {
    const { supabase, insert } = fakeSupabase([]);
    const { result } = renderHook(() => useChat(supabase, identity, 'uid-me'));

    await act(async () => { await result.current.sendMessage('hello'); });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ is_host: false, body: 'hello' }));
  });
});
