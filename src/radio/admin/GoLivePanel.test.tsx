import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GoLivePanel from './GoLivePanel';
import { HostMixer } from '../rtc/hostMixer';
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

  vi.stubGlobal('Audio', class { play = vi.fn(() => Promise.resolve()); pause = vi.fn(); src = ''; });
  // handleEnd posts to the server end-broadcast phase.
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })));
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

  it('goes live (END BROADCAST) once onSessionReady fires; station write is server-side', async () => {
    // The server flips the station live during publish-offer, so onSessionReady just
    // reflects the live state. The client must NOT write the station itself.
    const sb = makeSupabase();
    mockPublisherConnect.mockImplementation(async () => {
      await Promise.resolve();
      publisherCallbacksRef.current?.onSessionReady('cf-test-123');
    });

    render(<GoLivePanel supabase={sb} authToken={async () => 'bearer-token'} />);
    await waitFor(() => screen.getByTestId('go-live-btn'));
    fireEvent.click(screen.getByTestId('go-live-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('end-btn')).toBeInTheDocument();
    }, { timeout: 3000 });
    expect(sb._update).not.toHaveBeenCalled();
  });

  it('ends the broadcast via the server end-broadcast phase', async () => {
    mockPublisherConnect.mockImplementation(async () => {
      await Promise.resolve();
      publisherCallbacksRef.current?.onSessionReady('cf-test-end');
    });

    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'token'} />);
    await waitFor(() => screen.getByTestId('go-live-btn'));
    fireEvent.click(screen.getByTestId('go-live-btn'));
    await waitFor(() => screen.getByTestId('end-btn'));

    fireEvent.click(screen.getByTestId('end-btn'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/rtc-session',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('end-broadcast'),
        }),
      );
    });
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

  it('uses a fresh audio element and tears down the mixer when retrying after onFatal', async () => {
    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'token'} />);
    await waitFor(() => screen.getByTestId('go-live-panel'));

    // Queue a file so the file-deck branch runs — that branch is what crashes on retry
    // (createMediaElementSource cannot reuse an element across sessions).
    const fileInput = screen.getByTestId('go-live-panel').querySelector('input[type=file]')!;
    const file = new File([''], 'track.mp3', { type: 'audio/mpeg' });
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
    fireEvent.change(fileInput);

    // mock.results accumulates across tests in this file — clear so indices are local.
    const mixerMock = vi.mocked(HostMixer);
    mixerMock.mockClear();

    // Ensure the file actually landed in the deck before going live
    await waitFor(() => expect(screen.getByText('track')).toBeInTheDocument());

    // First GO LIVE
    fireEvent.click(screen.getByTestId('go-live-btn'));
    await waitFor(() => {
      expect(mixerMock.mock.results[0].value.addFileElement).toHaveBeenCalled();
    });
    const firstMixer = mixerMock.mock.results[0].value;
    const firstEl = firstMixer.addFileElement.mock.calls[0][0];

    // Fatal failure (e.g. 403) — should reset to GO LIVE and tear the mixer down
    act(() => {
      publisherCallbacksRef.current?.onFatal?.('Admin role missing.');
    });
    await waitFor(() => {
      expect(screen.getByTestId('go-live-btn')).toHaveTextContent('GO LIVE');
    });
    expect(firstMixer.stop).toHaveBeenCalled();

    // Retry: a brand-new mixer with a brand-new audio element (never the reused one)
    fireEvent.click(screen.getByTestId('go-live-btn'));
    await waitFor(() => {
      expect(mixerMock.mock.results[1].value.addFileElement).toHaveBeenCalled();
    });
    const secondEl = mixerMock.mock.results[1].value.addFileElement.mock.calls[0][0];

    expect(secondEl).not.toBe(firstEl);
  });

  it('reports status changes to onStatusChange (idle, then live)', async () => {
    const onStatusChange = vi.fn();
    mockPublisherConnect.mockImplementation(async () => {
      await Promise.resolve();
      publisherCallbacksRef.current?.onSessionReady('cf-status');
    });

    render(
      <GoLivePanel
        supabase={makeSupabase()}
        authToken={async () => 'token'}
        onStatusChange={onStatusChange}
      />,
    );
    await waitFor(() => screen.getByTestId('go-live-btn'));
    expect(onStatusChange).toHaveBeenCalledWith('idle');

    fireEvent.click(screen.getByTestId('go-live-btn'));
    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('live'));
  });

  it('surfaces an error instead of spinning forever when reconnects are exhausted', async () => {
    vi.useFakeTimers();
    try {
      render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'token'} />);
      await act(async () => { await Promise.resolve(); });

      await act(async () => {
        fireEvent.click(screen.getByTestId('go-live-btn'));
        await Promise.resolve();
      });

      // Each ERROR in 'connecting' schedules a retry; advancing the clock fires it and
      // returns to 'connecting'. After MAX_RETRIES the FSM reaches 'lost'.
      for (let i = 0; i < 7; i++) {
        await act(async () => {
          publisherCallbacksRef.current?.onDispatch({ type: 'ERROR' });
          await vi.advanceTimersByTimeAsync(31_000);
        });
      }

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByTestId('go-live-btn')).toHaveTextContent('GO LIVE');
    } finally {
      vi.useRealTimers();
    }
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
