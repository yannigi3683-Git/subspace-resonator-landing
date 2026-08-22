import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { dedupeByDevice, usePresenceObserver } from './usePresenceObserver';
import { makeSupabase } from '../supabaseClient';
import type { PresenceEntry } from '../types';

vi.mock('../supabaseClient', () => ({ makeSupabase: vi.fn() }));

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
    const legacy = { ...entry('a', 'A', ''), deviceId: undefined };
    expect(dedupeByDevice([legacy, legacy])).toHaveLength(1);
    expect(dedupeByDevice([legacy, { ...entry('b', 'B', ''), deviceId: undefined }])).toHaveLength(2);
  });

  it('returns empty for empty input', () => {
    expect(dedupeByDevice([])).toEqual([]);
  });
});

function makeChannel(state: Record<string, unknown[]> = {}) {
  const handlers: Record<string, () => void> = {};
  const channel = {
    handlers,
    on: vi.fn((_t: string, filter: { event: string }, cb: () => void) => {
      handlers[filter.event] = cb;
      return channel;
    }),
    subscribe: vi.fn().mockReturnThis(),
    presenceState: vi.fn(() => state),
  };
  return channel;
}

function makeObserver(channels: ReturnType<typeof makeChannel>[]) {
  let i = 0;
  return {
    channel: vi.fn(() => channels[Math.min(i++, channels.length - 1)]),
    removeChannel: vi.fn().mockResolvedValue('ok'),
    realtime: { setAuth: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn() },
  } as unknown as SupabaseClient;
}

const meta = (uid: string, deviceId: string) => ({
  uid, name: uid, avatarId: 'a', deviceId, position: { x: 0, y: 0 },
});

const mocked = vi.mocked(makeSupabase);

beforeEach(() => {
  mocked.mockReturnValue(makeObserver([makeChannel()]));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('usePresenceObserver', () => {
  it('reports the deduped roster from the channel', async () => {
    const ch = makeChannel({ a: [meta('u1', 'dev-1')], b: [meta('u2', 'dev-1')], c: [meta('u3', 'dev-2')] });
    mocked.mockReturnValue(makeObserver([ch]));

    const { result } = renderHook(() => usePresenceObserver(async () => 't'));
    await act(async () => {});
    act(() => ch.handlers.sync());

    expect(result.current).toHaveLength(2); // dev-1 collapsed
  });

  it('rejoins every 60s so a missed leave cannot survive the broadcast', async () => {
    // Measured 2026-08-22: console 21 and guest floor ~21 while the server held 12. Only a fresh
    // presence_state prunes, and a channel that never reconnects never receives a second one.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = makeChannel({ a: [meta('u1', 'dev-1')], b: [meta('u2', 'dev-2')] });
    const second = makeChannel({ a: [meta('u1', 'dev-1')] }); // server truth: u2 left long ago
    const observer = makeObserver([first, second]);
    mocked.mockReturnValue(observer);

    const { result } = renderHook(() => usePresenceObserver(async () => 't'));
    await act(async () => {});
    act(() => first.handlers.sync());
    expect(result.current).toHaveLength(2);

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(observer.removeChannel).toHaveBeenCalledWith(first);
    expect(observer.channel).toHaveBeenCalledTimes(2);
    // Held over the gap: blanking the roster would re-seed every avatar once a minute.
    expect(result.current).toHaveLength(2);

    act(() => second.handlers.sync());
    expect(result.current).toHaveLength(1);
  });

  it('re-auths on every rejoin so the private channel outlives the token', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const observer = makeObserver([makeChannel(), makeChannel()]);
    mocked.mockReturnValue(observer);
    const tokens = ['token-1', 'token-2'];
    let i = 0;

    renderHook(() => usePresenceObserver(async () => tokens[i++] ?? 'x'));
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(observer.realtime.setAuth).toHaveBeenNthCalledWith(1, 'token-1');
    expect(observer.realtime.setAuth).toHaveBeenNthCalledWith(2, 'token-2');
  });

  it('never tracks, so a rejoin is invisible to the rest of the room', async () => {
    // Rebuilding a channel that tracks would broadcast leave+join to everyone every cycle and
    // re-seed the avatar at a new random position on every other screen.
    const ch = makeChannel();
    mocked.mockReturnValue(makeObserver([ch]));

    renderHook(() => usePresenceObserver(async () => 't'));
    await act(async () => {});

    expect((ch as unknown as { track?: unknown }).track).toBeUndefined();
    expect(ch.on).toHaveBeenCalledWith('presence', { event: 'sync' }, expect.any(Function));
  });

  it('keeps the last roster when the token cannot be read', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = makeChannel({ a: [meta('u1', 'dev-1')] });
    const observer = makeObserver([first, makeChannel()]);
    mocked.mockReturnValue(observer);
    let calls = 0;
    const getToken = async () => {
      calls += 1;
      if (calls > 1) throw new Error('session gone');
      return 't';
    };

    const { result } = renderHook(() => usePresenceObserver(getToken));
    await act(async () => {});
    act(() => first.handlers.sync());
    expect(result.current).toHaveLength(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(observer.channel).toHaveBeenCalledTimes(1); // no new channel built
    expect(result.current).toHaveLength(1); // roster survives
  });
});
