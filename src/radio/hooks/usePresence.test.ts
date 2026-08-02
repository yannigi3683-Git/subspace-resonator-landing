import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dedupeByDevice, usePresence, CHEER_COOLDOWN_MS } from './usePresence';
import type { PresenceEntry, Identity } from '../types';

const entry = (uid: string, name: string, deviceId: string): PresenceEntry => ({
  uid,
  name,
  avatarId: 'nebula',
  deviceId,
  position: { x: 10, y: 20 },
});

describe('dedupeByDevice', () => {
  it('collapses a stale ghost and the current entry from the same device (different uid/name) to one (the latest)', () => {
    // The "yanni + yanni test" bug: one browser, two presence metas with different
    // anonymous uids from re-auth, same stable deviceId.
    const list = [entry('uid-old', 'yanni test', 'dev-1'), entry('uid-new', 'yanni', 'dev-1')];
    const out = dedupeByDevice(list);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('yanni');
  });

  it('keeps genuinely different devices separate', () => {
    const list = [entry('a', 'A', 'dev-1'), entry('b', 'B', 'dev-2'), entry('c', 'C', 'dev-3')];
    expect(dedupeByDevice(list)).toHaveLength(3);
  });

  it('falls back to uid when deviceId is absent (legacy/ghost entries)', () => {
    const legacy = { uid: 'g', name: 'ghost', avatarId: 'nebula', position: { x: 1, y: 2 } } as PresenceEntry;
    expect(dedupeByDevice([legacy, legacy])).toHaveLength(1);
  });

  it('returns empty for empty input', () => {
    expect(dedupeByDevice([])).toEqual([]);
  });
});

// The cheer rides the presence payload, so its throttle has to live in the hook: a second
// trigger (another button, a key repeat, an impatient tap) must not be able to route around it.
// track() rebroadcasts to every subscriber, and at 120 listeners an unthrottled pulse is a
// presence storm competing with the audio stream.
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
