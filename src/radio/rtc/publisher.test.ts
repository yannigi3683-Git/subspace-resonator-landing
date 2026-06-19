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

  it('dispatches ERROR (not onFatal) when server returns 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
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
