import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadIceServers } from './iceServers';

const STUN = { urls: 'stun:stun.l.google.com:19302' };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadIceServers', () => {
  it('ignores broker TURN and returns STUN-only (TURN in the pool causes ICE flapping)', async () => {
    const turn = { urls: 'turn:turn.cloudflare.com:443?transport=tcp', username: 'u', credential: 'c' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ iceServers: turn }) }));

    const servers = await loadIceServers('/api/rtc-session', async () => 'tok');

    expect(servers).toEqual([STUN]);
  });

  it('falls back to STUN-only when the broker returns no TURN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ iceServers: null }) }));

    const servers = await loadIceServers('/api/rtc-session', async () => 'tok');

    expect(servers).toEqual([STUN]);
  });

  it('falls back to STUN-only on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const servers = await loadIceServers('/api/rtc-session', async () => 'tok');

    expect(servers).toEqual([STUN]);
  });

  it('falls back to STUN-only when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const servers = await loadIceServers('/api/rtc-session', async () => 'tok');

    expect(servers).toEqual([STUN]);
  });
});
