import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AdminConsole from './AdminConsole';
import { makeSupabase } from '../supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

// The presence observer runs on its OWN client so a rebuild can never disturb the socket that
// carries room:control / room:nowplaying to listeners. Tests drive that client, not the prop.
vi.mock('../supabaseClient', () => ({ makeSupabase: vi.fn() }));

// AdminConsole's job is tab / mount-persistence / live-indicator coordination — not RTC.
// Mock GoLivePanel with a stub that lets the test drive onStatusChange.
vi.mock('./GoLivePanel', () => ({
  default: ({ onStatusChange, listenerCount, suggestedTitle }: { onStatusChange?: (s: string) => void; listenerCount?: number; suggestedTitle?: { title: string; when: string } | null }) => (
    <div data-testid="go-live-panel">
      <span data-testid="suggested">{suggestedTitle ? `${suggestedTitle.title} | ${suggestedTitle.when}` : 'none'}</span>
      <span data-testid="listener-count">{listenerCount}</span>
      <button data-testid="fake-go-live" onClick={() => onStatusChange?.('live')}>
        go
      </button>
      <button data-testid="fake-end" onClick={() => onStatusChange?.('idle')}>
        end
      </button>
    </div>
  ),
}));

// The schedule's data and the server clock are their own hooks with their own tests; here they are
// fixed so the console's coordination is what is under test.
const SHOW_AT = Date.UTC(2026, 10, 29, 20, 0);
const scheduleState = {
  shows: [
    { id: 'tonight', title: 'Psy Night Vol. 7', starts_at: new Date(SHOW_AT).toISOString(), aired_at: null },
    { id: 'later', title: 'Goa Classics 1998', starts_at: new Date(SHOW_AT + 7 * 86_400_000).toISOString(), aired_at: null },
  ],
  now: SHOW_AT - 20 * 60_000,
  markAired: vi.fn(async () => {}),
};
vi.mock('../hooks/useSchedule', () => ({
  useSchedule: () => ({
    shows: scheduleState.shows, error: null, saving: false,
    reload: vi.fn(), add: vi.fn(), update: vi.fn(), remove: vi.fn(),
    markAired: scheduleState.markAired,
  }),
}));
vi.mock('../hooks/useServerClock', () => ({ useServerClock: () => () => new Date(scheduleState.now) }));

// A stand-in panel that can be told to crash on render, to prove the crash stays inside its tab.
const panelState = { crash: false };
vi.mock('./SchedulePanel', () => ({
  default: () => {
    if (panelState.crash) throw new Error('schedule panel exploded');
    return <div data-testid="schedule-panel" />;
  },
}));

// One presence channel stub. `state` is read live so a rebuild can return different rosters.
function makeChannel(state: Record<string, unknown[]> = {}) {
  const handlers: Record<string, () => void> = {};
  const channel = {
    handlers,
    on: vi.fn((_type: string, filter: { event: string }, cb: () => void) => {
      handlers[filter.event] = cb;
      return channel;
    }),
    subscribe: vi.fn().mockReturnThis(),
    presenceState: vi.fn(() => state),
  };
  return channel;
}

// The observer client AdminConsole builds for itself. Hands out a fresh channel per call so the
// test can tell a rebuild from a reuse.
function makeObserver(channels: ReturnType<typeof makeChannel>[]) {
  let i = 0;
  return {
    channel: vi.fn(() => channels[Math.min(i++, channels.length - 1)]),
    removeChannel: vi.fn().mockResolvedValue('ok'),
    realtime: { setAuth: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn() },
  } as unknown as SupabaseClient;
}

// The prop client. It must NOT be used for presence any more — only passed down to GoLivePanel.
function makeProp(): SupabaseClient {
  return { channel: vi.fn(), removeChannel: vi.fn() } as unknown as SupabaseClient;
}

const mockedMakeSupabase = vi.mocked(makeSupabase);

beforeEach(() => {
  mockedMakeSupabase.mockReturnValue(makeObserver([makeChannel()]));
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  panelState.crash = false;
  scheduleState.now = SHOW_AT - 20 * 60_000;
});

describe('AdminConsole', () => {
  it('keeps the broadcast panel mounted when switching to another tab', () => {
    render(<AdminConsole supabase={makeProp()} authToken={async () => 't'} />);
    expect(screen.getByTestId('go-live-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('SCHEDULE'));

    // Still in the DOM (hidden), NOT unmounted — a live broadcast must survive tab changes.
    expect(screen.getByTestId('go-live-panel')).toBeInTheDocument();
  });

  it('shows OFF AIR initially and ON AIR once the broadcast goes live', () => {
    render(<AdminConsole supabase={makeProp()} authToken={async () => 't'} />);
    expect(screen.getByTestId('broadcast-status-badge')).toHaveTextContent('OFF AIR');

    fireEvent.click(screen.getByTestId('fake-go-live'));

    expect(screen.getByTestId('broadcast-status-badge')).toHaveTextContent('ON AIR');
  });

  it('keeps the ON AIR indicator visible even when viewing another tab', () => {
    render(<AdminConsole supabase={makeProp()} authToken={async () => 't'} />);
    fireEvent.click(screen.getByTestId('fake-go-live'));

    fireEvent.click(screen.getByText('MODERATION'));

    expect(screen.getByTestId('broadcast-status-badge')).toHaveTextContent('ON AIR');
  });

  it('dedupes the host listener count by deviceId so same-device ghosts do not inflate it', async () => {
    // Two presence refs from the SAME device (e.g. anon re-auth minted a new uid) must count as 1,
    // matching what listeners see. presenceState() is keyed per connection, so two refs live under
    // two keys but share a deviceId.
    const channel = makeChannel({
      ref_old: [{ uid: 'uid-old', name: 'A', avatarId: 'a1', deviceId: 'dev-1', position: { x: 0, y: 0 } }],
      ref_new: [{ uid: 'uid-new', name: 'A', avatarId: 'a1', deviceId: 'dev-1', position: { x: 0, y: 0 } }],
    });
    mockedMakeSupabase.mockReturnValue(makeObserver([channel]));

    render(<AdminConsole supabase={makeProp()} authToken={async () => 't'} />);
    await act(async () => {});
    fireEvent.click(screen.getByTestId('fake-go-live'));
    act(() => channel.handlers.sync());

    expect(screen.getByTestId('listener-count')).toHaveTextContent('1');
  });

  it('rebuilds the presence observer every 60s so a frozen map cannot survive the show', async () => {
    // The observer never reconnects on a healthy broadcast, so it never receives a second
    // presence_state — the only thing that prunes a stale entry. Measured 2026-08-21: the console
    // read 7+ while the server held 3. Rejoining on a timer is what re-prunes.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const first = makeChannel({
      a: [{ uid: 'u1', name: 'A', avatarId: 'a', deviceId: 'dev-1', position: { x: 0, y: 0 } }],
      b: [{ uid: 'u2', name: 'B', avatarId: 'b', deviceId: 'dev-2', position: { x: 0, y: 0 } }],
    });
    // Second join sees server truth: dev-2 left long ago, the first map just never heard about it.
    const second = makeChannel({
      a: [{ uid: 'u1', name: 'A', avatarId: 'a', deviceId: 'dev-1', position: { x: 0, y: 0 } }],
    });
    const observer = makeObserver([first, second]);
    mockedMakeSupabase.mockReturnValue(observer);

    render(<AdminConsole supabase={makeProp()} authToken={async () => 't'} />);
    await act(async () => {});
    act(() => first.handlers.sync());
    expect(screen.getByTestId('listener-count')).toHaveTextContent('2');

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(observer.removeChannel).toHaveBeenCalledWith(first);
    expect(observer.channel).toHaveBeenCalledTimes(2);

    // The stale count must survive the gap between teardown and the replacement's first sync —
    // a flash of 0 would fire the badge's key-change animation on every rebuild.
    expect(screen.getByTestId('listener-count')).toHaveTextContent('2');

    act(() => second.handlers.sync());
    expect(screen.getByTestId('listener-count')).toHaveTextContent('1');
  });

  it('re-auths the observer on every rebuild so the private channel outlives the admin JWT', async () => {
    // room:main is private, so Realtime authorizes it against the JWT. The console tab outlives the
    // 1h token; a rebuild that reused a stale one would be dropped server-side and freeze again.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const observer = makeObserver([makeChannel(), makeChannel()]);
    mockedMakeSupabase.mockReturnValue(observer);
    const tokens = ['token-1', 'token-2'];
    let i = 0;

    render(<AdminConsole supabase={makeProp()} authToken={async () => tokens[i++] ?? 'x'} />);
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(observer.realtime.setAuth).toHaveBeenNthCalledWith(1, 'token-1');
    expect(observer.realtime.setAuth).toHaveBeenNthCalledWith(2, 'token-2');
  });

  it('never opens a presence channel on the shared prop client', async () => {
    // That client carries room:control / room:nowplaying to listeners. Keeping the observer off it
    // means no rebuild can ever reach the audio-adjacent path, by construction rather than by care.
    const prop = makeProp();
    render(<AdminConsole supabase={prop} authToken={async () => 't'} />);
    await act(async () => {});

    expect(prop.channel).not.toHaveBeenCalled();
  });

  it('shows the schedule panel on the SCHEDULE tab', () => {
    render(<AdminConsole supabase={makeProp()} authToken={async () => 't'} />);
    fireEvent.click(screen.getByText('SCHEDULE'));
    expect(screen.getByTestId('schedule-panel')).toBeInTheDocument();
    expect(screen.queryByText(/coming in M8/)).toBeNull();
  });

  it('keeps the broadcast panel and GO LIVE alive when the schedule panel crashes', () => {
    // An unmounted GoLivePanel orphans a live connection and takes END BROADCAST with it, so a
    // schedule bug must stay inside its own tab.
    panelState.crash = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<AdminConsole supabase={makeProp()} authToken={async () => 't'} />);
    fireEvent.click(screen.getByText('SCHEDULE'));
    expect(screen.getByText('Schedule failed to load.')).toBeInTheDocument();
    expect(screen.getByTestId('go-live-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByText('BROADCAST'));
    fireEvent.click(screen.getByTestId('fake-go-live'));
    expect(screen.getByTestId('broadcast-status-badge')).toHaveTextContent('ON AIR');
  });

  it('marks the show starting now as aired when the broadcast goes live, once', () => {
    render(<AdminConsole supabase={makeProp()} authToken={async () => 't'} />);
    fireEvent.click(screen.getByTestId('fake-go-live'));
    fireEvent.click(screen.getByTestId('fake-go-live'));
    expect(scheduleState.markAired).toHaveBeenCalledTimes(1);
    expect(scheduleState.markAired).toHaveBeenCalledWith('tonight');
  });

  it('marks nothing for a broadcast nowhere near a scheduled show', () => {
    scheduleState.now = SHOW_AT - 5 * 3_600_000;
    render(<AdminConsole supabase={makeProp()} authToken={async () => 't'} />);
    fireEvent.click(screen.getByTestId('fake-go-live'));
    expect(scheduleState.markAired).not.toHaveBeenCalled();
  });

  it('can mark the next show after the broadcast ends and a new one starts', () => {
    render(<AdminConsole supabase={makeProp()} authToken={async () => 't'} />);
    fireEvent.click(screen.getByTestId('fake-go-live'));
    fireEvent.click(screen.getByTestId('fake-end'));
    scheduleState.now = SHOW_AT + 7 * 86_400_000 - 10 * 60_000;
    fireEvent.click(screen.getByTestId('fake-go-live'));
    expect(scheduleState.markAired).toHaveBeenNthCalledWith(2, 'later');
  });

  it('hands the schedule suggestion to the broadcast panel, with its Israel time', () => {
    render(<AdminConsole supabase={makeProp()} authToken={async () => 't'} />);
    expect(screen.getByTestId('suggested')).toHaveTextContent('Psy Night Vol. 7 | 22:00 Israel');
  });

  it('suggests nothing when no show is within six hours', () => {
    scheduleState.now = SHOW_AT - 8 * 3_600_000;
    render(<AdminConsole supabase={makeProp()} authToken={async () => 't'} />);
    expect(screen.getByTestId('suggested')).toHaveTextContent('none');
  });
});
