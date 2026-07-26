import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { LiveRoom } from './LiveRoom';
import type { Identity, Station } from '../types';

const presence = { presenceList: [], count: 0, isKicked: false, isBanned: false, rename: vi.fn() };
const moderationApi = {
  canModerate: false,
  error: null as string | null,
  clearError: vi.fn(),
  deleteMessage: vi.fn(),
  kick: vi.fn(),
  ban: vi.fn(),
  unban: vi.fn(),
  setChat: vi.fn(),
};

vi.mock('../hooks/useChat', () => ({
  useChat: () => ({ messages: [], sendMessage: vi.fn(), sending: false, sendError: null }),
}));
vi.mock('../hooks/useReactions', () => ({
  useReactions: () => ({ reactions: {}, toggleReaction: vi.fn() }),
}));
vi.mock('../hooks/usePresence', () => ({ usePresence: () => presence }));
vi.mock('../hooks/useModeration', () => ({ useModeration: () => moderationApi }));
vi.mock('../hooks/useNowPlaying', () => ({ useNowPlaying: () => ({ name: '', visible: false }) }));
vi.mock('../hooks/useListenerTransport', () => ({
  useListenerTransport: () => ({
    playing: true,
    ready: true,
    connectionError: false,
    playbackBlocked: false,
    resume: vi.fn(),
    retry: vi.fn(),
    volume: 1,
    setVolume: vi.fn(),
    getStats: vi.fn(),
    stalls: 0,
    transportInfo: { phase: 'webrtc', hlsAvailable: false, hlsReady: false, hlsBufferedAhead: 0 },
  }),
}));
vi.mock('./DanceFloor', () => ({ DanceFloor: () => <div data-testid="dance-floor" /> }));

const identity: Identity = { name: 'Yanni', avatarId: 'nebula', deviceId: 'dev-1', position: { x: 1, y: 2 } };
const station: Station = {
  mode: 'live',
  live_title: 'Test',
  live_session: { cfSessionId: 'cf-1', startedAt: '2026-07-25T20:00:00Z' },
  slow_mode_s: 3,
  locked: false,
};

function renderRoom(overrides: Partial<Station> = {}) {
  return render(
    <LiveRoom
      supabase={{} as SupabaseClient}
      identity={identity}
      uid="uid-me"
      station={{ ...station, ...overrides }}
      onIdentityChange={vi.fn()}
    />,
  );
}

describe('LiveRoom', () => {
  beforeEach(() => {
    presence.isKicked = false;
    presence.isBanned = false;
    moderationApi.canModerate = false;
    moderationApi.error = null;
  });

  it('renders the room for a normal listener', () => {
    renderRoom();
    expect(screen.getByTestId('dance-floor')).toBeInTheDocument();
  });

  // A ban must take the audio with it, not just the chat: the early return unmounts the
  // whole room, audio element included.
  it('replaces the room with SIGNAL BLOCKED when banned', () => {
    presence.isBanned = true;
    renderRoom();
    expect(screen.getByText('SIGNAL BLOCKED')).toBeInTheDocument();
    expect(screen.queryByTestId('dance-floor')).not.toBeInTheDocument();
  });

  it('replaces the room with REMOVED FROM ROOM when kicked', () => {
    presence.isKicked = true;
    renderRoom();
    expect(screen.getByText('REMOVED FROM ROOM')).toBeInTheDocument();
    expect(screen.queryByTestId('dance-floor')).not.toBeInTheDocument();
  });

  it('shows a banned listener the blocked screen even if also kicked', () => {
    presence.isBanned = true;
    presence.isKicked = true;
    renderRoom();
    expect(screen.getByText('SIGNAL BLOCKED')).toBeInTheDocument();
  });

  it('gives a normal listener no chat controls', () => {
    renderRoom();
    expect(screen.queryByText('LOCK CHAT')).not.toBeInTheDocument();
    expect(screen.queryByText('SLOW')).not.toBeInTheDocument();
  });

  it('offers the host sign-in to a session that cannot yet moderate', () => {
    renderRoom();
    expect(screen.getByTestId('host-login-trigger')).toBeInTheDocument();
  });

  it('hides the host sign-in once the session is elevated', () => {
    moderationApi.canModerate = true;
    renderRoom();
    expect(screen.queryByTestId('host-login-trigger')).not.toBeInTheDocument();
  });

  it('shows slow-mode and lock controls to the host', () => {
    moderationApi.canModerate = true;
    renderRoom();
    expect(screen.getByText('SLOW')).toBeInTheDocument();
    expect(screen.getByText('LOCK CHAT')).toBeInTheDocument();
  });

  it('reflects the current slow-mode setting as pressed', () => {
    moderationApi.canModerate = true;
    renderRoom({ slow_mode_s: 30 });
    expect(screen.getByRole('button', { name: '30s' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'OFF' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('labels the lock button by its current state', () => {
    moderationApi.canModerate = true;
    renderRoom({ locked: true });
    expect(screen.getByText('CHAT LOCKED')).toBeInTheDocument();
  });

  it('surfaces a moderation error', () => {
    moderationApi.canModerate = true;
    moderationApi.error = 'Session expired. Sign in again to moderate.';
    renderRoom();
    expect(screen.getByRole('alert')).toHaveTextContent(/sign in again/i);
  });
});
