import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { usePresence, CHEER_COOLDOWN_MS } from './usePresence';
import type { Identity } from '../types';

describe('usePresence roster', () => {
  const identity: Identity = {
    name: 'Yanni',
    avatarId: 'nebula',
    deviceId: 'dev-1',
    position: { x: 10, y: 20 },
  };

  it('reads the roster from its own tracking channel, deduped by device', async () => {
    // Deliberately NOT the rejoining observer that AdminConsole uses. That would need a second
    // Realtime client per listener, and Supabase Free allows 200 concurrent clients total, so it
    // would halve the room from ~200 people to ~100. This roster drifts upward on a long session;
    // a listener can refresh to recount, which the host cannot. See usePresenceObserver.
    const handlers: Record<string, () => void> = {};
    const channel = {
      on: vi.fn((_t: string, filter: { event: string }, cb: () => void) => { handlers[filter.event] = cb; return channel; }),
      subscribe: vi.fn().mockReturnThis(),
      track: vi.fn().mockResolvedValue(undefined),
      untrack: vi.fn().mockResolvedValue(undefined),
      presenceState: vi.fn(() => ({
        ref_a: [{ uid: 'u1', name: 'A', avatarId: 'a', deviceId: 'dev-1', position: { x: 0, y: 0 } }],
        ref_b: [{ uid: 'u2', name: 'A2', avatarId: 'a', deviceId: 'dev-1', position: { x: 0, y: 0 } }],
        ref_c: [{ uid: 'u3', name: 'B', avatarId: 'b', deviceId: 'dev-2', position: { x: 0, y: 0 } }],
      })),
    };
    const supabase = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    } as unknown as SupabaseClient;

    const { result } = renderHook(() => usePresence(supabase, identity, 'u1'));
    act(() => handlers.sync());

    expect(result.current.count).toBe(2); // dev-1's two refs collapse to one
  });

  it('opens exactly one Realtime channel, so a listener costs one connection', async () => {
    // The 200-concurrent-client ceiling is per CLIENT, and every listener holds one. Anything that
    // adds a second here halves how many people fit in the room.
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      track: vi.fn().mockResolvedValue(undefined),
      untrack: vi.fn().mockResolvedValue(undefined),
      presenceState: vi.fn(() => ({})),
    };
    const supabase = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    } as unknown as SupabaseClient;

    renderHook(() => usePresence(supabase, identity, 'u1'));

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(supabase.channel).toHaveBeenCalledWith('room:main', { config: { private: true } });
  });
});

describe('usePresence cheer', () => {
  const identity: Identity = {
    name: 'Yanni',
    avatarId: 'nebula',
    deviceId: 'dev-1',
    position: { x: 10, y: 20 },
  };

  function harness() {
    const channel = {
      on: vi.fn(function (this: unknown) { return channel; }),
      subscribe: vi.fn((cb: (s: string) => void) => { cb('SUBSCRIBED'); return channel; }),
      track: vi.fn().mockResolvedValue({}),
      untrack: vi.fn().mockResolvedValue({}),
      presenceState: vi.fn(() => ({})),
    };
    const supabase = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
    } as unknown as SupabaseClient;
    return { supabase, channel };
  }

  afterEach(() => vi.restoreAllMocks());

  it('broadcasts a timestamped cheer through presence', () => {
    const { supabase, channel } = harness();
    const { result } = renderHook(() => usePresence(supabase, identity, 'uid-1'));

    channel.track.mockClear();
    expect(result.current.cheer()).toBe(true);

    expect(channel.track).toHaveBeenCalledTimes(1);
    const payload = channel.track.mock.calls[0][0];
    expect(payload.cheerAt).toBeTypeOf('number');
    expect(payload.uid).toBe('uid-1');
    expect(payload.deviceId).toBe('dev-1');
  });

  it('drops a second cheer inside the cooldown', () => {
    const { supabase, channel } = harness();
    const { result } = renderHook(() => usePresence(supabase, identity, 'uid-1'));

    result.current.cheer();
    channel.track.mockClear();

    expect(result.current.cheer()).toBe(false);
    expect(channel.track).not.toHaveBeenCalled();
  });

  it('allows the next cheer once the cooldown has passed', () => {
    const { supabase, channel } = harness();
    const { result } = renderHook(() => usePresence(supabase, identity, 'uid-1'));

    const t0 = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(t0);
    result.current.cheer();

    vi.spyOn(Date, 'now').mockReturnValue(t0 + CHEER_COOLDOWN_MS + 1);
    channel.track.mockClear();

    expect(result.current.cheer()).toBe(true);
    expect(channel.track).toHaveBeenCalledTimes(1);
  });
});
