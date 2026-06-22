import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GoLivePanel from './GoLivePanel';
import { HostMixer } from '../rtc/hostMixer';
import { useStation } from '../hooks/useStation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PublisherCallbacks } from '../rtc/publisher';

// useStation reads/subscribes to the DB station row. GoLivePanel uses it only to detect an
// orphaned "still live from a previous session" state; default to null (no station) so the
// existing tests are unaffected.
vi.mock('../hooks/useStation', () => ({ useStation: vi.fn(() => null) }));

// --- Module mocks ---
// GoLivePanel tests verify coordination logic (ordering, error handling, UI state).
// RTC internals (WebRTC, AudioContext, getUserMedia) are tested in their own suites.

// Captures the most recently constructed mixer so tests can assert resume() on tab return.
const mixerInstanceRef: { current: { resume: ReturnType<typeof vi.fn> } | null } = { current: null };

vi.mock('../rtc/hostMixer', () => ({
  // Must use a regular function (not arrow) — arrow functions can't be constructors.
  HostMixer: vi.fn().mockImplementation(function () {
    let fileCounter = 0;
    const instance = {
      start: vi.fn().mockResolvedValue({
        getTracks: () => [],
        getAudioTracks: () => [],
      } as unknown as MediaStream),
      addAudioDevice: vi.fn().mockResolvedValue('src-1'),
      addFileElement: vi.fn(() => `file-${++fileCounter}`),
      setGain: vi.fn(),
      rampGain: vi.fn(),
      resume: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
      removeSource: vi.fn(),
      get analysis() { return null; },
      get entries() { return [] as const; },
    };
    mixerInstanceRef.current = instance;
    return instance;
  }),
}));

// Capture the callbacks GoLivePanel passes to Publisher so tests can trigger
// onSessionReady at the right moment.
const publisherCallbacksRef: { current: PublisherCallbacks | null } = { current: null };
const mockPublisherConnect = vi.fn();
const mockSetQualityCeiling = vi.fn();

vi.mock('../rtc/publisher', () => ({
  // Must use a regular function (not arrow) — arrow functions can't be constructors.
  Publisher: vi.fn().mockImplementation(function (callbacks: PublisherCallbacks) {
    publisherCallbacksRef.current = callbacks;
    return { connect: mockPublisherConnect, disconnect: vi.fn(), setQualityCeiling: mockSetQualityCeiling };
  }),
}));

// --- Supabase mock ---

function makeSupabase(updateResult: { error: null | { message: string } } = { error: null }) {
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue(updateResult),
  });
  return {
    from: vi.fn().mockReturnValue({ update }),
    channel: vi.fn().mockReturnValue({
      subscribe: vi.fn((cb?: (s: string) => void) => { cb?.('SUBSCRIBED'); return {}; }),
      send: vi.fn(),
    }),
    removeChannel: vi.fn(),
    _update: update,
  } as unknown as SupabaseClient & { _update: ReturnType<typeof vi.fn> };
}

// --- Per-test setup ---

const mockEnumerateDevices = vi.fn();

// Records every <audio> the panel creates, and supports the transport surface
// (currentTime/duration/onended) so the file-deck tests can drive playback.
const audioInstances: FakeAudioEl[] = [];
class FakeAudioEl {
  play = vi.fn(() => Promise.resolve());
  pause = vi.fn();
  src = '';
  currentTime = 0;
  duration = 100;
  onended: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  constructor() {
    audioInstances.push(this);
  }
}

beforeEach(() => {
  vi.restoreAllMocks();

  // Default: no live station (restoreAllMocks may have cleared the factory default).
  vi.mocked(useStation).mockReturnValue(null);

  publisherCallbacksRef.current = null;
  mockSetQualityCeiling.mockClear();
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

  audioInstances.length = 0;
  vi.stubGlobal('Audio', FakeAudioEl);
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

  it('best-effort ends the broadcast on pagehide (reload/close) while live', async () => {
    mockPublisherConnect.mockImplementation(async () => {
      await Promise.resolve();
      publisherCallbacksRef.current?.onSessionReady('cf-unload');
    });

    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'tok'} />);
    await waitFor(() => screen.getByTestId('go-live-btn'));
    fireEvent.click(screen.getByTestId('go-live-btn'));
    await waitFor(() => screen.getByTestId('end-btn'));

    vi.mocked(fetch).mockClear();
    act(() => { window.dispatchEvent(new Event('pagehide')); });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/rtc-session',
        expect.objectContaining({
          body: expect.stringContaining('end-broadcast'),
          keepalive: true,
        }),
      );
    });
  });

  it('does NOT fire an end beacon on pagehide when idle (no broadcast running)', async () => {
    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'tok'} />);
    await waitFor(() => screen.getByTestId('go-live-btn'));

    vi.mocked(fetch).mockClear();
    act(() => { window.dispatchEvent(new Event('pagehide')); });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('holds a screen wake lock while live and re-wakes the audio graph on tab return', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    mockPublisherConnect.mockImplementation(async () => {
      await Promise.resolve();
      publisherCallbacksRef.current?.onSessionReady('cf-wl');
    });

    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'tok'} />);
    await waitFor(() => screen.getByTestId('go-live-btn'));
    fireEvent.click(screen.getByTestId('go-live-btn'));
    await waitFor(() => screen.getByTestId('end-btn'));

    // Acquired on going live.
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'));

    // Returning to the foreground re-wakes the AudioContext and re-acquires the lock.
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); });

    expect(mixerInstanceRef.current?.resume).toHaveBeenCalled();
    expect(request.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('shows a recovery banner and can clear a station left live by a previous session', async () => {
    vi.mocked(useStation).mockReturnValue({
      mode: 'live',
      live_title: 'Old Session',
      live_session: null,
      slow_mode_s: 0,
      locked: false,
    } as ReturnType<typeof useStation>);

    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 'tok'} />);
    await waitFor(() => screen.getByTestId('force-end-btn'));

    fireEvent.click(screen.getByTestId('force-end-btn'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/rtc-session',
        expect.objectContaining({ body: expect.stringContaining('end-broadcast') }),
      );
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

describe('GoLivePanel file deck transport (Phase B)', () => {
  async function goLiveWithFiles(names: string[]) {
    mockPublisherConnect.mockImplementation(async () => {
      await Promise.resolve();
      publisherCallbacksRef.current?.onSessionReady('cf-deck');
    });

    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 't'} />);
    await waitFor(() => screen.getByTestId('go-live-panel'));

    const fileInput = screen.getByTestId('go-live-panel').querySelector('input[type=file]')!;
    const files = names.map((n) => new File([''], `${n}.mp3`, { type: 'audio/mpeg' }));
    Object.defineProperty(fileInput, 'files', { value: files, configurable: true });
    fireEvent.change(fileInput);
    await waitFor(() => screen.getByText(names[0]));

    fireEvent.click(screen.getByTestId('go-live-btn'));
    await waitFor(() => screen.getByTestId('end-btn'));
  }

  function playlistJumpRows() {
    return within(screen.getByLabelText('Playlist'))
      .getAllByRole('button')
      .filter((b) => !b.getAttribute('aria-label')?.startsWith('Remove'));
  }

  const lastAudio = () => audioInstances[audioInstances.length - 1];

  it('marks the first track current when the broadcast starts', async () => {
    await goLiveWithFiles(['alpha', 'beta']);
    const rows = playlistJumpRows();
    expect(rows[0]).toHaveAttribute('aria-current', 'true');
    expect(rows[1]).not.toHaveAttribute('aria-current', 'true');
  });

  it('NEXT advances track by swapping src, not adding a second mixer source', async () => {
    await goLiveWithFiles(['alpha', 'beta']);
    const mixerResults = vi.mocked(HostMixer).mock.results;
    const mixer = mixerResults[mixerResults.length - 1].value;
    expect(mixer.addFileElement).toHaveBeenCalledTimes(1);

    const fileEl = lastAudio();
    const firstSrc = fileEl.src;

    fireEvent.click(screen.getByLabelText('Next track'));

    expect(mixer.addFileElement).toHaveBeenCalledTimes(1);
    expect(fileEl.src).not.toBe(firstSrc);
    await waitFor(() => {
      expect(playlistJumpRows()[1]).toHaveAttribute('aria-current', 'true');
    });
  });

  it('seeks +/-10 seconds and clamps at zero', async () => {
    await goLiveWithFiles(['alpha']);
    const fileEl = lastAudio();
    fileEl.currentTime = 30;
    fileEl.duration = 100;

    fireEvent.click(screen.getByLabelText('Forward 10 seconds'));
    expect(fileEl.currentTime).toBe(40);

    fireEvent.click(screen.getByLabelText('Back 10 seconds'));
    expect(fileEl.currentTime).toBe(30);

    fileEl.currentTime = 5;
    fireEvent.click(screen.getByLabelText('Back 10 seconds'));
    expect(fileEl.currentTime).toBe(0);
  });

  it('auto-advances when a track ends and stops at the end of the queue', async () => {
    await goLiveWithFiles(['alpha', 'beta']);
    const fileEl = lastAudio();

    act(() => { fileEl.onended?.(); });
    await waitFor(() => {
      expect(playlistJumpRows()[1]).toHaveAttribute('aria-current', 'true');
    });

    act(() => { fileEl.onended?.(); });
    await waitFor(() => {
      expect(screen.getByLabelText('Play')).toBeInTheDocument();
    });
  });

  it('reveals manual quality controls and changes the ceiling when auto-pilot is off', async () => {
    mockPublisherConnect.mockImplementation(async () => {
      await Promise.resolve();
      publisherCallbacksRef.current?.onSessionReady('cf-q');
    });
    render(<GoLivePanel supabase={makeSupabase()} authToken={async () => 't'} />);
    await waitFor(() => screen.getByTestId('go-live-btn'));
    fireEvent.click(screen.getByTestId('go-live-btn'));
    await waitFor(() => screen.getByTestId('end-btn'));

    // Manual quality buttons are visible but dimmed (pointer-events-none) while AUTO-PILOT is on.
    expect(screen.getByRole('button', { name: /balanced/i })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/AUTO-PILOT/i)); // turn auto-pilot off
    fireEvent.click(screen.getByRole('button', { name: /balanced/i })); // pick 96k

    expect(mockSetQualityCeiling).toHaveBeenCalledWith(96);
  });

  it('shows the crossfade slider by default (AUTO-MIX on) and hides it when toggled off', async () => {
    await goLiveWithFiles(['alpha', 'beta']);
    expect(screen.getByLabelText('Crossfade seconds')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/AUTO-MIX/i));

    expect(screen.queryByLabelText('Crossfade seconds')).toBeNull();
  });

  it('crossfades into the next track near the end when AUTO-MIX is on', async () => {
    await goLiveWithFiles(['alpha', 'beta']);
    // AUTO-MIX is on by default now.

    const mixerResults = vi.mocked(HostMixer).mock.results;
    const mixer = mixerResults[mixerResults.length - 1].value;

    const activeEl = lastAudio();
    activeEl.duration = 100;
    activeEl.currentTime = 96; // 4s left, default fade 12s

    act(() => { activeEl.ontimeupdate?.(); });

    // A second deck was created and started; both gains ramped (out + in).
    expect(mixer.addFileElement).toHaveBeenCalledTimes(2);
    expect(mixer.rampGain).toHaveBeenCalledTimes(2);
    const inEl = lastAudio();
    expect(inEl).not.toBe(activeEl);
    expect(inEl.play).toHaveBeenCalled();
  });

  it('finalizes the crossfade after the fade window and makes the next track current', async () => {
    await goLiveWithFiles(['alpha', 'beta']);
    // AUTO-MIX is on by default now.
    const activeEl = lastAudio();
    activeEl.duration = 100;
    activeEl.currentTime = 96;

    vi.useFakeTimers();
    try {
      act(() => { activeEl.ontimeupdate?.(); });
      act(() => { vi.advanceTimersByTime(12000); }); // default fade window
      expect(playlistJumpRows()[1]).toHaveAttribute('aria-current', 'true');
    } finally {
      vi.useRealTimers();
    }
  });
});
