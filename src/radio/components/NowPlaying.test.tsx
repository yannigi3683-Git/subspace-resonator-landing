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

  it('swaps to the track name while it is in its peek window', () => {
    render(<NowPlaying station={liveStation} nowPlaying={{ name: 'Galaxy 604', visible: true }} />);
    expect(screen.getByText('Galaxy 604')).toBeInTheDocument();
    expect(screen.queryByText('Subspace Theory B2B GaiaX')).not.toBeInTheDocument();
  });

  it('shows the station title (not the track) when the peek window is closed', () => {
    render(<NowPlaying station={liveStation} nowPlaying={{ name: 'Galaxy 604', visible: false }} />);
    expect(screen.getByText('Subspace Theory B2B GaiaX')).toBeInTheDocument();
    expect(screen.queryByText('Galaxy 604')).not.toBeInTheDocument();
  });
});
