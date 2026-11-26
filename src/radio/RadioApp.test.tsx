import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Station } from './types';

// RadioApp builds its client at import time, so the fake must exist before the module loads.
const fake = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  signInAnonymously: vi.fn(),
}));
vi.mock('./supabaseClient', () => ({
  makeSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: fake.session } }),
      signInAnonymously: fake.signInAnonymously,
    },
  }),
}));
vi.mock('./hooks/useStation', () => ({ useStation: vi.fn() }));
vi.mock('./hooks/useServerClock', () => ({ useServerClock: () => () => new Date() }));
// Which screen the app chooses is what is under test; each screen has its own tests.
vi.mock('./components/EntryGate', () => ({ EntryGate: () => <div data-testid="entry-gate" /> }));
vi.mock('./components/StandbyScreen', () => ({ StandbyScreen: () => <div data-testid="standby" /> }));
vi.mock('./components/LiveRoom', () => ({ LiveRoom: () => <div data-testid="live-room" /> }));

import RadioApp from './RadioApp';
import { useStation } from './hooks/useStation';

const station = (mode: 'off' | 'live'): Station =>
  ({ mode, live_title: null, live_session: mode === 'live' ? { startedAt: '2026-11-29T20:00:00Z' } : null, slow_mode_s: 0, locked: false }) as unknown as Station;
const setStation = (s: Station | null) => vi.mocked(useStation).mockReturnValue(s);

beforeEach(() => {
  fake.session = null;
  fake.signInAnonymously.mockReset();
  localStorage.clear();
  setStation(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RadioApp: what an off-air visitor sees', () => {
  it('shows the countdown without asking for a name, and never signs in', async () => {
    setStation(station('off'));
    render(<RadioApp />);
    await act(async () => {});
    expect(screen.getByTestId('standby')).toBeInTheDocument();
    expect(screen.queryByTestId('entry-gate')).toBeNull();
    expect(fake.signInAnonymously).not.toHaveBeenCalled();
  });

  it('waits for the station row, then falls back to the entry screen after 3 s', async () => {
    vi.useFakeTimers();
    render(<RadioApp />);
    await act(async () => {});
    expect(screen.getByText('LOADING...')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(screen.getByTestId('entry-gate')).toBeInTheDocument();
  });

  it('switches from the countdown to the entry screen when the station goes live', async () => {
    setStation(station('off'));
    const { rerender } = render(<RadioApp />);
    await act(async () => {});
    expect(screen.getByTestId('standby')).toBeInTheDocument();
    setStation(station('live'));
    rerender(<RadioApp />);
    await act(async () => {});
    expect(screen.getByTestId('entry-gate')).toBeInTheDocument();
  });

  it('switches back to the countdown if the show ends while the visitor is on the entry screen', async () => {
    setStation(station('live'));
    const { rerender } = render(<RadioApp />);
    await act(async () => {});
    expect(screen.getByTestId('entry-gate')).toBeInTheDocument();
    setStation(station('off'));
    rerender(<RadioApp />);
    await act(async () => {});
    expect(screen.getByTestId('standby')).toBeInTheDocument();
  });

  it('keeps a banned device on SIGNAL BLOCKED, never the countdown', async () => {
    localStorage.setItem('radio_banned', '1');
    setStation(station('off'));
    render(<RadioApp />);
    await act(async () => {});
    expect(screen.getByText('SIGNAL BLOCKED')).toBeInTheDocument();
    expect(screen.queryByTestId('standby')).toBeNull();
  });

  it('still shows the countdown to a returning visitor through the room path', async () => {
    fake.session = { user: { id: 'u1' } };
    localStorage.setItem('radio_identity', JSON.stringify({ name: 'Nebula', avatarId: 'a1', deviceId: 'd1' }));
    setStation(station('off'));
    render(<RadioApp />);
    await act(async () => {});
    expect(screen.getByTestId('standby')).toBeInTheDocument();
  });
});
