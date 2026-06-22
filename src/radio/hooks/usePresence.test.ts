import { describe, it, expect } from 'vitest';
import { dedupeByUid } from './usePresence';
import type { PresenceEntry } from '../types';

const entry = (uid: string, name: string): PresenceEntry => ({
  uid,
  name,
  avatarId: 'nebula',
  position: { x: 10, y: 20 },
});

describe('dedupeByUid', () => {
  it('collapses duplicate uids to one entry (the most recent)', () => {
    const list = [entry('a', 'old'), entry('b', 'bee'), entry('a', 'new')];
    const out = dedupeByUid(list);
    expect(out).toHaveLength(2);
    expect(out.find((e) => e.uid === 'a')?.name).toBe('new');
  });

  it('keeps distinct uids untouched', () => {
    const list = [entry('a', 'a'), entry('b', 'b'), entry('c', 'c')];
    expect(dedupeByUid(list)).toHaveLength(3);
  });

  it('returns empty for empty input', () => {
    expect(dedupeByUid([])).toEqual([]);
  });
});
