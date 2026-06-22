import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NowPlaying } from './NowPlaying';
import type { Station } from '../types';

const liveStation: Station = {
  mode: 'live',
  live_title: 'Subspace Theory B2B GaiaX',
  live_session: { cfSessionId: 'abc' },
  slow_mode_s: 3,
  locked: false,
};

describe('NowPlaying', () => {
  it('shows dash/placeholder when station is null', () => {
    render(<NowPlaying station={null} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('shows dash when station has no live_title', () => {
    render(<NowPlaying station={{ ...liveStation, live_title: null }} />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders live_title when set', () => {
    render(<NowPlaying station={liveStation} />);
    expect(screen.getByText('Subspace Theory B2B GaiaX')).toBeInTheDocument();
    expect(screen.getByText('NOW PLAYING')).toBeInTheDocument();
  });
});
