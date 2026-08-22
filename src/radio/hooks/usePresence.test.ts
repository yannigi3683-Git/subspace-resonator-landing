import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { usePresence, CHEER_COOLDOWN_MS } from './usePresence';
import { usePresenceObserver } from './usePresenceObserver';
import type { PresenceEntry, Identity } from '../types';

vi.mock('./usePresenceObserver', () => ({ usePresenceObserver: vi.fn() }));

describe('usePresence roster', () => {
  const identity: Identity = {
    name: 'Yanni',
    avatarId: 'nebula',
    deviceId: 'dev-1',
    position: { x: 10, y: 20 },
  };

  it('reports the observer roster, not its own tracking channel', async () => {
    // The tracking channel track()s, so it can never be rejoined to re-prune; only the observer can.
    // Measured 2026-08-22: the dance floor showed ~21 while the server held 12.
    const roster: PresenceEntry[] = [
      { uid: 'u1', name: 'A', avatarId: 'a', deviceId: 'dev-1', position: { x: 0, y: 0 } },
      { uid: 'u2', name: 'B', avatarId: 'b', deviceId: 'dev-2', position: { x: 0, y: 0 } },
    ];
    vi.mocked(usePresenceObserver).mockReturnValue(roster);
    const channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      track: vi.fn().mockResolvedValue(undefined),
      untrack: vi.fn().mockResolvedValue(undefined),
      // A stale roster this hook must NOT be reading from any more.
      presenceState: vi.fn(() => ({ ghost: [{ uid: 'gone', name: 'Ghost', avatarId: 'g', deviceId: 'dev-9', position: { x: 0, y: 0 } }] })),
    };
    const supabase = {
      channel: vi.fn(() => channel),
      removeChannel: vi.fn(),
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 't' } } }) },
    } as unknown as SupabaseClient;

    const { result } = renderHook(() => usePresence(supabase, identity, 'u1'));

    expect(result.current.presenceList).toEqual(roster);
    expect(result.current.count).toBe(2);
    expect(result.current.presenceList.some((e) => e.name === 'Ghost')).toBe(false);
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
