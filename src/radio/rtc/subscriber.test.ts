import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subscriber } from './subscriber';

let mockPc: {
  ontrack: ((e: unknown) => void) | null;
  onconnectionstatechange: (() => void) | null;
  setRemoteDescription: ReturnType<typeof vi.fn>;
  createAnswer: ReturnType<typeof vi.fn>;
  setLocalDescription: ReturnType<typeof vi.fn>;
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
    close: vi.fn(),
    connectionState: 'new',
  };
  vi.stubGlobal('RTCPeerConnection', vi.fn().mockImplementation(function () { return mockPc; }));
});

afterEach(() => {
  vi.unstubAllGlobals();
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
