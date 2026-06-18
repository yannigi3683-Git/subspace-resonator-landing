import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GoLivePanel from './GoLivePanel';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublisherCallbacks } from '../rtc/publisher';

// --- Module mocks ---
// GoLivePanel tests verify coordination logic (ordering, error handling, UI state).
// RTC internals (WebRTC, AudioContext, getUserMedia) are tested in their own suites.

vi.mock('../rtc/hostMixer', () => ({
  // Must use a regular function (not arrow) — arrow functions can't be constructors.
  HostMixer: vi.fn().mockImplementation(function () {
    return {
      start: vi.fn().mockResolvedValue({
        getTracks: () => [],
        getAudioTracks: () => [],
      } as unknown as MediaStream),
      addAudioDevice: vi.fn().mockResolvedValue('src-1'),
      addFileElement: vi.fn().mockReturnValue('src-2'),
      setGain: vi.fn(),
      stop: vi.fn(),
      removeSource: vi.fn(),
      get analysis() { return null; },
      get entries() { return [] as const; },
    };
  }),
}));

// Capture the callbacks GoLivePanel passes to Publisher so tests can trigger
// onSessionReady at the right moment.
const publisherCallbacksRef: { current: PublisherCallbacks | null } = { current: null };
const mockPublisherConnect = vi.fn();

vi.mock('../rtc/publisher', () => ({
  // Must use a regular function (not arrow) — arrow functions can't be constructors.
  Publisher: vi.fn().mockImplementation(function (callbacks: PublisherCallbacks) {
    publisherCallbacksRef.current = callbacks;
    return { connect: mockPublisherConnect, disconnect: vi.fn() };
  }),
}));

// --- Supabase mock ---

function makeSupabase(updateResult: { error: null | { message: string } } = { error: null }) {
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue(updateResult),
  });
  return {
    from: vi.fn().mockReturnValue({ update }),
    _update: update,
  } as unknown as SupabaseClient & { _update: ReturnType<typeof vi.fn> };
}

// --- Per-test setup ---

const mockEnumerateDevices = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();

  publisherCallbacksRef.current = null;
  // Default: connect resolves without triggering onSessionReady.
  mockPublisherConnect.mockResolvedValue(undefined);

  mockEnumerateDevices.mockResolvedValue([
    { kind: 'audioinput', deviceId: 'dev-1', label: 'Virtual Cable In', groupId: '' },
  ]);

  Object.defineProperty(navigator, 'mediaDevices', {
    value: { enumerateDevices: mockEnumerateDevices, getUserMedia: vi.fn() },
    configurable: true,
    writable: true,
  });

  vi.stubGlobal('Audio', class { play = vi.fn(); pause = vi.fn(); src = ''; });
});

// --- Tests ---

describe('GoLivePanel', () => {
  it('renders the GO LIVE button initially', async () => {
    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'token'} />);
    await waitFor(() => {
      expect(screen.getByTestId('go-live-btn')).toBeInTheDocument();
    });
  });

  it('shows the device selector populated from enumerateDevices', async () => {
    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'token'} />);
    await waitFor(() => {
      expect(screen.getByText('Virtual Cable In')).toBeInTheDocument();
    });
  });

  it('shows ENABLE AUDIO ACCESS when device labels are blank (no mic permission yet)', async () => {
    mockEnumerateDevices.mockReset();
    mockEnumerateDevices.mockResolvedValue([
      { kind: 'audioinput', deviceId: 'dev-1', label: '', groupId: '' },
    ]);
    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'token'} />);
    await waitFor(() => {
      expect(screen.getByTestId('enable-audio-btn')).toBeInTheDocument();
    });
  });

  it('populates the device dropdown after enabling audio access', async () => {
    mockEnumerateDevices.mockReset();
    mockEnumerateDevices
      .mockResolvedValueOnce([{ kind: 'audioinput', deviceId: 'dev-1', label: '', groupId: '' }])
      .mockResolvedValue([
        { kind: 'audioinput', deviceId: 'dev-1', label: 'Built-in Microphone', groupId: '' },
      ]);
    const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] });
    (navigator.mediaDevices as unknown as { getUserMedia: typeof getUserMedia }).getUserMedia =
      getUserMedia;

    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'token'} />);
    await waitFor(() => screen.getByTestId('enable-audio-btn'));
    fireEvent.click(screen.getByTestId('enable-audio-btn'));

    await waitFor(() => {
      expect(screen.getByText('Built-in Microphone')).toBeInTheDocument();
    });
    expect(getUserMedia).toHaveBeenCalled();
  });

  it('CRITICAL: station update happens AFTER onSessionReady fires (cfSessionId present)', async () => {
    const sb = makeSupabase();

    // connect calls onSessionReady with the CF session id — the contract GoLivePanel must honour
    mockPublisherConnect.mockImplementation(async () => {
      await Promise.resolve();
      publisherCallbacksRef.current?.onSessionReady('cf-test-123');
    });

    render(<GoLivePanel supabase={sb} authToken={async () => 'bearer-token'} />);
    await waitFor(() => screen.getByTestId('go-live-btn'));

    // Supabase must NOT be updated before GO LIVE
    expect(sb._update).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('go-live-btn'));

    await waitFor(() => {
      expect(sb._update).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'live',
          live_session: expect.objectContaining({ cfSessionId: 'cf-test-123' }),
        }),
      );
    }, { timeout: 3000 });
  });

  it('shows error alert when station update fails', async () => {
    const sb = makeSupabase({ error: { message: 'RLS denied' } });

    mockPublisherConnect.mockImplementation(async () => {
      await Promise.resolve();
      publisherCallbacksRef.current?.onSessionReady('cf-test-err');
    });

    render(<GoLivePanel supabase={sb} authToken={async () => 'token'} />);
    await waitFor(() => screen.getByTestId('go-live-btn'));
    fireEvent.click(screen.getByTestId('go-live-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows error and resets to GO LIVE when Publisher calls onFatal', async () => {
    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'token'} />);
    await waitFor(() => screen.getByTestId('go-live-btn'));
    fireEvent.click(screen.getByTestId('go-live-btn'));

    act(() => {
      publisherCallbacksRef.current?.onFatal?.('Permission denied. Verify admin role.');
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Permission denied');
      expect(screen.getByTestId('go-live-btn')).toHaveTextContent('GO LIVE');
    });
  });

  it('adds files to the deck queue and displays them', async () => {
    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'token'} />);
    await waitFor(() => screen.getByTestId('go-live-panel'));

    const fileInput = screen.getByTestId('go-live-panel').querySelector('input[type=file]');
    expect(fileInput).toBeTruthy();

    const file = new File([''], 'my-track.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput!);

    await waitFor(() => {
      expect(screen.getByText('my track')).toBeInTheDocument();
    });
  });
});
