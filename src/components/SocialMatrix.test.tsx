import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SocialMatrix from './SocialMatrix';

describe('SocialMatrix', () => {
  it('renders without crashing', () => {
    render(<SocialMatrix />);
    expect(screen.getByRole('region', { name: /social/i })).toBeInTheDocument();
  });

  it('has id="connect"', () => {
    render(<SocialMatrix />);
    expect(document.getElementById('connect')).toBeInTheDocument();
  });

  it('renders STREAM, FOLLOW, CATALOGUE group labels', () => {
    render(<SocialMatrix />);
    expect(screen.getByText('STREAM')).toBeInTheDocument();
    expect(screen.getByText('FOLLOW')).toBeInTheDocument();
    expect(screen.getByText('CATALOGUE')).toBeInTheDocument();
  });

  it('all links open in new tab with rel', () => {
    render(<SocialMatrix />);
    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('SoundCloud link present', () => {
    render(<SocialMatrix />);
    expect(screen.getByRole('link', { name: /soundcloud/i })).toBeInTheDocument();
  });

  it('Instagram link present', () => {
    render(<SocialMatrix />);
    expect(screen.getByRole('link', { name: /instagram/i })).toBeInTheDocument();
  });
});
