import { describe, it, expect, beforeEach, vi } from 'vitest';
import { derivePosition, getOrCreateIdentity, saveIdentity, createIdentity, updateIdentity, shouldForceReentry, getIdentitySession, setIdentitySession } from './identity';

// jsdom provides localStorage; mock crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });

beforeEach(() => {
  localStorage.clear();
});

describe('derivePosition', () => {
  it('returns x in [5, 90] and y in [15, 85]', () => {
    for (const id of ['abc', 'hello', crypto.randomUUID?.() ?? 'test', '00000000-0000-0000-0000-000000000000']) {
      const pos = derivePosition(id);
      expect(pos.x).toBeGreaterThanOrEqual(5);
      expect(pos.x).toBeLessThanOrEqual(90);
      expect(pos.y).toBeGreaterThanOrEqual(15);
      expect(pos.y).toBeLessThanOrEqual(85);
    }
  });

  it('is deterministic for the same input', () => {
    const a = derivePosition('my-device-id');
    const b = derivePosition('my-device-id');
    expect(a).toEqual(b);
  });
});

describe('getOrCreateIdentity', () => {
  it('returns null when nothing stored', () => {
    expect(getOrCreateIdentity()).toBeNull();
  });

  it('returns parsed identity after saveIdentity', () => {
    const id = createIdentity('TestUser', 'nebula');
    saveIdentity(id);
    const loaded = getOrCreateIdentity();
    expect(loaded).toEqual(id);
  });
});

describe('createIdentity', () => {
  it('populates all fields', () => {
    const id = createIdentity('Alice', 'vortex');
    expect(id.name).toBe('Alice');
    expect(id.avatarId).toBe('vortex');
    expect(id.deviceId).toBe('test-uuid-1234');
    expect(typeof id.position.x).toBe('number');
    expect(typeof id.position.y).toBe('number');
  });

  it('trims and caps name at 24 chars', () => {
    const id = createIdentity('  ' + 'A'.repeat(30) + '  ', 'nebula');
    expect(id.name.length).toBeLessThanOrEqual(24);
    expect(id.name).toBe('A'.repeat(24));
  });
});

describe('updateIdentity', () => {
  it('updates name and avatarId, preserves deviceId and position', () => {
    const original = createIdentity('Alice', 'nebula');
    saveIdentity(original);
    const updated = updateIdentity('Bob', 'vortex');
    expect(updated.name).toBe('Bob');
    expect(updated.avatarId).toBe('vortex');
    expect(updated.deviceId).toBe(original.deviceId);
    expect(updated.position).toEqual(original.position);
  });

  it('persists to localStorage', () => {
    const original = createIdentity('Alice', 'nebula');
    saveIdentity(original);
    updateIdentity('Charlie', 'pulsar');
    const stored = getOrCreateIdentity();
    expect(stored?.name).toBe('Charlie');
    expect(stored?.avatarId).toBe('pulsar');
  });

  it('throws if no identity stored', () => {
    expect(() => updateIdentity('Bob', 'vortex')).toThrow();
  });
});

describe('shouldForceReentry', () => {
  it('forces when a live broadcast id differs from the saved one', () => {
    expect(shouldForceReentry('cf-NEW', 'cf-OLD')).toBe(true);
  });

  it('forces when no identity-session is saved yet', () => {
    expect(shouldForceReentry('cf-NEW', null)).toBe(true);
  });

  it('does not force within the same broadcast', () => {
    expect(shouldForceReentry('cf-SAME', 'cf-SAME')).toBe(false);
  });

  it('does not force when the station is offline (no current session)', () => {
    expect(shouldForceReentry(undefined, 'cf-OLD')).toBe(false);
    expect(shouldForceReentry(null, null)).toBe(false);
  });
});

describe('identity session marker', () => {
  it('round-trips the broadcast id the identity was picked for', () => {
    expect(getIdentitySession()).toBeNull();
    setIdentitySession('cf-123');
    expect(getIdentitySession()).toBe('cf-123');
  });
});
