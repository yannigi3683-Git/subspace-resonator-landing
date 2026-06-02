import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MusicPlayer from './MusicPlayer';

describe('MusicPlayer', () => {
  it('renders without crashing', () => {
    render(<MusicPlayer />);
  });

  it('has id="music"', () => {
    render(<MusicPlayer />);
    expect(document.getElementById('music')).toBeInTheDocument();
  });

  it('renders TRACKS and PLAYLISTS tabs', () => {
    render(<MusicPlayer />);
    expect(screen.getByRole('tab', { name: /tracks/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /playlists/i })).toBeInTheDocument();
  });

  it('play/pause button has aria-label', () => {
    render(<MusicPlayer />);
    const btns = screen.getAllByRole('button', { name: /play|pause/i });
    expect(btns.length).toBeGreaterThan(0);
  });

  it('progress bar has role=slider', () => {
    render(<MusicPlayer />);
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);
  });

  it('external streaming links present', () => {
    render(<MusicPlayer />);
    expect(screen.getByRole('link', { name: /bandcamp/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /youtube/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /spotify/i })).toBeInTheDocument();
  });
});
