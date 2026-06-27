import type { Identity } from './types';

/** djb2-style hash of a string to unsigned 32-bit int */
function hash32(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Derives a stable crowd-area position from deviceId.
 * x: 5-90 (%), y: 15-85 (%) — keeps away from stage strip (top ~15%) and edges.
 */
export function derivePosition(deviceId: string): { x: number; y: number } {
  const h = hash32(deviceId);
  const h2 = hash32(deviceId + '1');
  return {
    x: (h % 86) + 5,      // 5-90
    y: (h2 % 71) + 15,    // 15-85
  };
}

const STORAGE_KEY = 'radio_identity';

export function getOrCreateIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Identity;
  } catch {}
  return null;
}

export function saveIdentity(identity: Identity): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
}

export function createIdentity(name: string, avatarId: string): Identity {
  const deviceId = crypto.randomUUID();
  return {
    name: name.trim().slice(0, 24),
    avatarId,
    deviceId,
    position: derivePosition(deviceId),
  };
}

export function updateIdentity(name: string, avatarId: string): Identity {
  const existing = getOrCreateIdentity();
  if (!existing) throw new Error('No identity to update');
  const updated = { ...existing, name, avatarId };
  saveIdentity(updated);
  return updated;
}

const SESSION_KEY = 'radio_session';

/** The broadcast (cfSessionId) the saved identity was last picked for, or null. */
export function getIdentitySession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setIdentitySession(cfSessionId: string): void {
  try {
    localStorage.setItem(SESSION_KEY, cfSessionId);
  } catch {}
}

/**
 * Whether the viewer must re-pick name/avatar: only when a broadcast is live and its id differs
 * from the one the saved identity was chosen for. Offline (no current id) never forces.
 */
export function shouldForceReentry(
  currentSessionId: string | null | undefined,
  savedSessionId: string | null | undefined,
): boolean {
  return !!currentSessionId && currentSessionId !== savedSessionId;
}
