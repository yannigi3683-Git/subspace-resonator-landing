import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subscriber } from './subscriber';

let mockPc: {
  ontrack: ((e: unknown) => void) | null;
  onconnectionstatechange: (() => void) | null;
  setRemoteDescription: ReturnType<typeof vi.fn>;
  createAnswer: ReturnType<typeof vi.fn>;
  setLocalDescription: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  connectionState: string;
};

beforeEach(() => {
  mockPc = {
    ontrack: null,
    onconnectionstatechange: null,
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'v=0' }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue(new Map()),
    close: vi.fn(),
    connectionState: 'new',
  };
  vi.stubGlobal('RTCPeerConnection', vi.fn().mockImplementation(function () { return mockPc; }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Subscriber ICE transport policy', () => {
  it('uses all policy when TURN credentials are in the ice servers (TURN is fallback, not forced)', async () => {
    let pcConfig: RTCConfiguration | undefined;
    vi.stubGlobal('RTCPeerConnection', vi.fn().mockImplementation(function (cfg: RTCConfiguration) {
      pcConfig = cfg;
      return mockPc;
    }));
    const turn = { urls: 'turn:turn.cloudflare.com:443?transport=tcp', username: 'u', credential: 'c' };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const phase = JSON.parse(init.body as string).phase;
      if (phase === 'ice-servers') return Promise.resolve({ ok: true, json: async () => ({ iceServers: turn }) });
      return Promise.resolve({ ok: false, status: 500 });
    }));
    await new Subscriber({ onStreamReady: vi.fn(), onDispatch: vi.fn() }, '/api/rtc-session', async () => 'tok').connect();
    expect(pcConfig?.iceTransportPolicy).toBe('all');
  });

  it('uses all policy when no TURN credentials are available', async () => {
    let pcConfig: RTCConfiguration | undefined;
    vi.stubGlobal('RTCPeerConnection', vi.fn().mockImplementation(function (cfg: RTCConfiguration) {
      pcConfig = cfg;
      return mockPc;
    }));
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const phase = JSON.parse(init.body as string).phase;
      if (phase === 'ice-servers') return Promise.resolve({ ok: true, json: async () => ({ iceServers: null }) });
      return Promise.resolve({ ok: false, status: 500 });
    }));
    await new Subscriber({ onStreamReady: vi.fn(), onDispatch: vi.fn() }, '/api/rtc-session', async () => 'tok').connect();
    expect(pcConfig?.iceTransportPolicy).toBe('all');
  });
});

describe('Subscriber getStats candidateType', () => {
  it('returns relay candidateType when the active candidate pair is a relay', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('stop')));
    const sub = new Subscriber({ onStreamReady: vi.fn(), onDispatch: vi.fn() }, '/api/rtc-session', async () => 'tok');
    await sub.connect();

    const relayLocalId = 'local-relay-1';
    const fakeStats = new Map([
      ['pair-1', { type: 'candidate-pair', nominated: true, currentRoundTripTime: 0.05, localCandidateId: relayLocalId }],
      [relayLocalId, { type: 'local-candidate', candidateType: 'relay' }],
    ]);
    mockPc.getStats = vi.fn().mockResolvedValue(fakeStats);

    const stats = await sub.getStats();
    expect(stats?.candidateType).toBe('relay');
  });

  it('returns host candidateType when the active pair is direct', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('stop')));
    const sub = new Subscriber({ onStreamReady: vi.fn(), onDispatch: vi.fn() }, '/api/rtc-session', async () => 'tok');
    await sub.connect();

    const localId = 'local-host-1';
    const fakeStats = new Map([
      ['pair-1', { type: 'candidate-pair', nominated: true, currentRoundTripTime: 0.005, localCandidateId: localId }],
      [localId, { type: 'local-candidate', candidateType: 'host' }],
    ]);
    mockPc.getStats = vi.fn().mockResolvedValue(fakeStats);

    const stats = await sub.getStats();
    expect(stats?.candidateType).toBe('host');
  });
});

describe('Subscriber jitter buffer', () => {
  it('enlarges the receiver jitter buffer when a track arrives', async () => {
    // Fail the first fetch so connect() returns early — ontrack is wired before that.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('stop')));
    const onStreamReady = vi.fn();
    const sub = new Subscriber(
      { onStreamReady, onDispatch: vi.fn() },
      '/api/rtc-session',
      async () => 'tok',
      1500,
    );
    await sub.connect();

    expect(mockPc.ontrack).toBeTypeOf('function');
    // A real RTCRtpReceiver exposes jitterBufferTarget (often null) on its prototype, so the
    // `in` check passes; mirror that here.
    const receiver: { jitterBufferTarget: number | null } = { jitterBufferTarget: null };
    mockPc.ontrack!({ receiver, streams: [{}] });

    expect(receiver.jitterBufferTarget).toBe(1500);
    expect(onStreamReady).toHaveBeenCalled();
  });
});
