import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminConsole from './AdminConsole';
import type { SupabaseClient } from '@supabase/supabase-js';

// AdminConsole's job is tab / mount-persistence / live-indicator coordination — not RTC.
// Mock GoLivePanel with a stub that lets the test drive onStatusChange.
vi.mock('./GoLivePanel', () => ({
  default: ({ onStatusChange, listenerCount }: { onStatusChange?: (s: string) => void; listenerCount?: number }) => (
    <div data-testid="go-live-panel">
      <span data-testid="listener-count">{listenerCount}</span>
      <button data-testid="fake-go-live" onClick={() => onStatusChange?.('live')}>
        go
      </button>
    </div>
  ),
}));

function makeSupabase(): SupabaseClient {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
    presenceState: vi.fn().mockReturnValue({}),
  };
  return {
    channel: vi.fn().mockReturnValue(channel),
    removeChannel: vi.fn(),
  } as unknown as SupabaseClient;
}

describe('AdminConsole', () => {
  it('keeps the broadcast panel mounted when switching to another tab', () => {
    render(<AdminConsole supabase={makeSupabase()} authToken={async () => 't'} />);
    expect(screen.getByTestId('go-live-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByText('SCHEDULE'));

    // Still in the DOM (hidden), NOT unmounted — a live broadcast must survive tab changes.
    expect(screen.getByTestId('go-live-panel')).toBeInTheDocument();
  });

  it('shows OFF AIR initially and ON AIR once the broadcast goes live', () => {
    render(<AdminConsole supabase={makeSupabase()} authToken={async () => 't'} />);
    expect(screen.getByTestId('broadcast-status-badge')).toHaveTextContent('OFF AIR');

    fireEvent.click(screen.getByTestId('fake-go-live'));

    expect(screen.getByTestId('broadcast-status-badge')).toHaveTextContent('ON AIR');
  });

  it('keeps the ON AIR indicator visible even when viewing another tab', () => {
    render(<AdminConsole supabase={makeSupabase()} authToken={async () => 't'} />);
    fireEvent.click(screen.getByTestId('fake-go-live'));

    fireEvent.click(screen.getByText('MODERATION'));

    expect(screen.getByTestId('broadcast-status-badge')).toHaveTextContent('ON AIR');
  });

  it('dedupes the host listener count by deviceId so same-device ghosts do not inflate it', () => {
    // Two presence refs from the SAME device (e.g. anon re-auth minted a new uid) must count as 1,
    // matching what listeners see. presenceState() is keyed per connection, so two refs live under
    // two keys but share a deviceId.
    const handlers: Record<string, () => void> = {};
    const channel = {
      on: vi.fn((_type: string, filter: { event: string }, cb: () => void) => {
        handlers[filter.event] = cb;
        return channel;
      }),
      subscribe: vi.fn().mockReturnThis(),
      presenceState: vi.fn().mockReturnValue({
        ref_old: [{ uid: 'uid-old', name: 'A', avatarId: 'a1', deviceId: 'dev-1', position: { x: 0, y: 0 } }],
        ref_new: [{ uid: 'uid-new', name: 'A', avatarId: 'a1', deviceId: 'dev-1', position: { x: 0, y: 0 } }],
      }),
    };
    const supabase = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    } as unknown as SupabaseClient;

    render(<AdminConsole supabase={supabase} authToken={async () => 't'} />);
    fireEvent.click(screen.getByTestId('fake-go-live'));
    act(() => handlers.sync());

    expect(screen.getByTestId('listener-count')).toHaveTextContent('1');
  });
});
