import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminConsole from './AdminConsole';
import type { SupabaseClient } from '@supabase/supabase-js';

// AdminConsole's job is tab / mount-persistence / live-indicator coordination — not RTC.
// Mock GoLivePanel with a stub that lets the test drive onStatusChange.
vi.mock('./GoLivePanel', () => ({
  default: ({ onStatusChange }: { onStatusChange?: (s: string) => void }) => (
    <div data-testid="go-live-panel">
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
});
