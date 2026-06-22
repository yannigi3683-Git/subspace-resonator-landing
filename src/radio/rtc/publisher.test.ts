import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Publisher } from './publisher';

// Minimal RTCPeerConnection stand-in — just enough for Publisher.connect() to run.
let mockPc: {
  addTrack: ReturnType<typeof vi.fn>;
  createOffer: ReturnType<typeof vi.fn>;
  setLocalDescription: ReturnType<typeof vi.fn>;
  setRemoteDescription: ReturnType<typeof vi.fn>;
  getSenders: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  connectionState: string;
  onconnectionstatechange: (() => void) | null;
};

beforeEach(() => {
  mockPc = {
    addTrack: vi.fn(),
    createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'v=0\r\n' }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
    getSenders: vi.fn().mockReturnValue([]),
    close: vi.fn(),
    connectionState: 'new',
    onconnectionstatechange: null,
  };
  vi.stubGlobal('RTCPeerConnection', vi.fn().mockImplementation(function () { return mockPc; }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const makeStream = (): MediaStream => ({ getAudioTracks: () => [] } as unknown as MediaStream);

const makeCallbacks = () => ({
  onSessionReady: vi.fn(),
  onDispatch: vi.fn(),
  onQualityChange: vi.fn(),
  onFatal: vi.fn(),
});

describe('Publisher HTTP error handling', () => {
  it('calls onFatal with a 2FA message when 403 reason is not_aal2', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ reason: 'not_aal2' }) }),
    );
    const cb = makeCallbacks();
    await new Publisher(cb, '/api/rtc-session', async () => 'tok').connect(makeStream());
    expect(cb.onFatal).toHaveBeenCalledWith(expect.stringMatching(/two-factor/i));
    expect(cb.onDispatch).not.toHaveBeenCalledWith({ type: 'ERROR' });
  });

  it('calls onFatal with an admin-role message when 403 reason is not_admin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ reason: 'not_admin' }) }),
    );
    const cb = makeCallbacks();
    await new Publisher(cb, '/api/rtc-session', async () => 'tok').connect(makeStream());
    expect(cb.onFatal).toHaveBeenCalledWith(expect.stringMatching(/admin role/i));
    expect(cb.onDispatch).not.toHaveBeenCalledWith({ type: 'ERROR' });
  });

  it('calls onFatal (not ERROR) when server returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const cb = makeCallbacks();
    await new Publisher(cb, '/api/rtc-session', async () => 'tok').connect(makeStream());
    expect(cb.onFatal).toHaveBeenCalledWith(expect.stringMatching(/session expired/i));
    expect(cb.onDispatch).not.toHaveBeenCalledWith({ type: 'ERROR' });
  });

  it('calls onFatal (not ERROR) when server returns 500 — a config error retrying cannot fix', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const cb = makeCallbacks();
    await new Publisher(cb, '/api/rtc-session', async () => 'tok').connect(makeStream());
    expect(cb.onFatal).toHaveBeenCalledWith(expect.stringMatching(/server/i));
    expect(cb.onDispatch).not.toHaveBeenCalledWith({ type: 'ERROR' });
  });

  it('dispatches ERROR (retryable, not onFatal) when server returns 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    const cb = makeCallbacks();
    await new Publisher(cb, '/api/rtc-session', async () => 'tok').connect(makeStream());
    expect(cb.onDispatch).toHaveBeenCalledWith({ type: 'ERROR' });
    expect(cb.onFatal).not.toHaveBeenCalled();
  });

  it('dispatches ERROR (not onFatal) on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net::ERR_FAILED')));
    const cb = makeCallbacks();
    await new Publisher(cb, '/api/rtc-session', async () => 'tok').connect(makeStream());
    expect(cb.onDispatch).toHaveBeenCalledWith({ type: 'ERROR' });
    expect(cb.onFatal).not.toHaveBeenCalled();
  });
});

describe('Publisher connection state transitions', () => {
  const connectLive = async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cfSessionId: 'cf-1', sdpAnswer: 'v=0\r\n' }) }),
    );
    const cb = makeCallbacks();
    await new Publisher(cb, '/api/rtc-session', async () => 'tok').connect(makeStream());
    return cb;
  };

  it('does NOT dispatch DISCONNECTED on a transient "disconnected" (it self-recovers)', async () => {
    const cb = await connectLive();
    mockPc.connectionState = 'disconnected';
    mockPc.onconnectionstatechange?.();
    expect(cb.onDispatch).not.toHaveBeenCalledWith({ type: 'DISCONNECTED' });
  });

  it('dispatches DISCONNECTED on "failed" (a permanent loss)', async () => {
    const cb = await connectLive();
    mockPc.connectionState = 'failed';
    mockPc.onconnectionstatechange?.();
    expect(cb.onDispatch).toHaveBeenCalledWith({ type: 'DISCONNECTED' });
  });

  it('dispatches CONNECTED on "connected"', async () => {
    const cb = await connectLive();
    mockPc.connectionState = 'connected';
    mockPc.onconnectionstatechange?.();
    expect(cb.onDispatch).toHaveBeenCalledWith({ type: 'CONNECTED' });
  });
});

describe('Publisher audio bitrate (FR-4)', () => {
  it('caps the audio sender bitrate at 128 kbps for upload stability', async () => {
    const setParameters = vi.fn().mockResolvedValue(undefined);
    const sender = { track: { kind: 'audio' }, getParameters: () => ({}), setParameters };
    mockPc.getSenders.mockReturnValue([sender]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ cfSessionId: 'cf-1', sdpAnswer: 'v=0\r\n' }),
      }),
    );
    const cb = makeCallbacks();
    await new Publisher(cb, '/api/rtc-session', async () => 'tok').connect(makeStream());
    expect(setParameters).toHaveBeenCalledWith(
      expect.objectContaining({
        encodings: [expect.objectContaining({ maxBitrate: 128_000 })],
      }),
    );
  });
});

describe('Publisher ICE servers', () => {
  it('includes the TURN server and uses all policy when the broker returns TURN credentials', async () => {
    let pcConfig: RTCConfiguration | undefined;
    vi.stubGlobal('RTCPeerConnection', vi.fn().mockImplementation(function (cfg: RTCConfiguration) {
      pcConfig = cfg;
      return mockPc;
    }));
    const turn = { urls: 'turn:turn.cloudflare.com:443?transport=tcp', username: 'u', credential: 'c' };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const phase = JSON.parse(init.body as string).phase;
      if (phase === 'ice-servers') return Promise.resolve({ ok: true, json: async () => ({ iceServers: turn }) });
      return Promise.resolve({ ok: true, json: async () => ({ cfSessionId: 'x', sdpAnswer: 'v=0' }) });
    }));
    await new Publisher(makeCallbacks(), '/api/rtc-session', async () => 'tok').connect(makeStream());

    expect(pcConfig?.iceServers).toEqual(expect.arrayContaining([turn]));
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
      return Promise.resolve({ ok: true, json: async () => ({ cfSessionId: 'x', sdpAnswer: 'v=0' }) });
    }));
    await new Publisher(makeCallbacks(), '/api/rtc-session', async () => 'tok').connect(makeStream());

    expect(pcConfig?.iceTransportPolicy).toBe('all');
  });
});

describe('Publisher adaptive quality', () => {
  it('forces stereo Opus in the published SDP offer', async () => {
    mockPc.createOffer.mockResolvedValue({
      type: 'offer',
      sdp: 'v=0\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10\r\n',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cfSessionId: 'x', sdpAnswer: 'v=0' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const cb = makeCallbacks();
    await new Publisher(cb, '/api/rtc-session', async () => 'tok').connect(makeStream());

    // connect() now fetches ICE servers first, so locate the publish-offer call by its body.
    const offerCall = fetchMock.mock.calls.find((c) => {
      try { return JSON.parse((c[1] as RequestInit).body as string).phase === 'publish-offer'; }
      catch { return false; }
    });
    const body = JSON.parse((offerCall![1] as RequestInit).body as string);
    expect(body.sdpOffer).toMatch(/stereo=1/);
    expect(body.sdpOffer).toMatch(/useinbandfec=1/);
  });

  it('lowers the sender bitrate immediately when the quality ceiling drops', async () => {
    const setParameters = vi.fn().mockResolvedValue(undefined);
    const sender = {
      track: { kind: 'audio' },
      getParameters: () => ({ encodings: [{}] }),
      setParameters,
    };
    mockPc.getSenders.mockReturnValue([sender]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cfSessionId: 'x', sdpAnswer: 'v=0' }) }),
    );
    const pub = new Publisher(makeCallbacks(), '/api/rtc-session', async () => 'tok', 160);
    await pub.connect(makeStream());

    setParameters.mockClear();
    pub.setQualityCeiling(96);
    await Promise.resolve();

    expect(setParameters).toHaveBeenCalledWith(
      expect.objectContaining({ encodings: [expect.objectContaining({ maxBitrate: 96_000 })] }),
    );
  });
});
