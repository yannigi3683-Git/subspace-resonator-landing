import { describe, it, expect } from 'vitest';
import { dedupeByDevice } from './usePresence';
import type { PresenceEntry } from '../types';

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
