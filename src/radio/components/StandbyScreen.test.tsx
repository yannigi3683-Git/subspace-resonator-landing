import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StandbyScreen } from './StandbyScreen';
import { makeSupabaseFake } from '../test-utils';

const mockGetServerTime = () => new Date('2026-01-01T12:00:00Z');

describe('StandbyScreen', () => {
  let supabase: ReturnType<typeof makeSupabaseFake>;

  beforeEach(() => {
    supabase = makeSupabaseFake();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders SIGNAL OFFLINE heading', async () => {
    render(
      <StandbyScreen supabase={supabase as never} getServerTime={mockGetServerTime} />,
    );
    expect(screen.getByText('SUBSPACE RADIO LIVE')).toBeInTheDocument();
    expect(screen.getByText('SIGNAL OFFLINE')).toBeInTheDocument();
  });

  it('shows TBA when no scheduled shows', async () => {
    await act(async () => {
      render(
        <StandbyScreen supabase={supabase as never} getServerTime={mockGetServerTime} />,
      );
    });
    expect(screen.getByText(/NEXT TRANSMISSION: TBA/i)).toBeInTheDocument();
  });

  it('shows countdown when a show is scheduled', async () => {
    const showData = [{ title: 'Goa Session', starts_at: '2026-01-01T13:00:00Z' }];
    const customSupabase = makeSupabaseFake({ messages: [] });
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: showData, error: null }),
    });
    customSupabase.from = mockFrom;

    await act(async () => {
      render(
        <StandbyScreen supabase={customSupabase as never} getServerTime={mockGetServerTime} />,
      );
    });

    expect(screen.getByText('01:00:00')).toBeInTheDocument();
    expect(screen.getByText('Goa Session')).toBeInTheDocument();
  });

  it('shows "Browse the archive" link to /#archive', async () => {
    await act(async () => {
      render(
        <StandbyScreen supabase={supabase as never} getServerTime={mockGetServerTime} />,
      );
    });
    const link = screen.getByRole('link', { name: /Browse the archive/i });
    expect(link).toHaveAttribute('href', '/#archive');
  });
});
