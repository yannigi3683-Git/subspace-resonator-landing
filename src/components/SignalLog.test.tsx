import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SignalLog from './SignalLog';

describe('SignalLog', () => {
  it('renders the discography region', () => {
    render(<SignalLog />);
    expect(screen.getByRole('region', { name: /discography/i })).toBeInTheDocument();
  });

  it('has id="archive"', () => {
    render(<SignalLog />);
    expect(document.getElementById('archive')).toBeInTheDocument();
  });

  it('renders both group labels', () => {
    render(<SignalLog />);
    expect(screen.getByText(/solo releases/i)).toBeInTheDocument();
    expect(screen.getByText(/compilation appearances/i)).toBeInTheDocument();
  });

  it('lists all six confirmed releases', () => {
    render(<SignalLog />);
    expect(screen.getByText(/the subspace theory/i)).toBeInTheDocument();
    expect(screen.getByText(/nightmare in heaven/i)).toBeInTheDocument();
    expect(screen.getAllByText(/galaxy 604/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/100 aliens/i)).toBeInTheDocument();
    expect(screen.getByText(/the call of goa, vol\. 5/i)).toBeInTheDocument();
    expect(screen.getByText(/psy trance 2026: space dj/i)).toBeInTheDocument();
  });

  it('links each release to its release page in a new tab', () => {
    render(<SignalLog />);
    const expected: Record<string, string> = {
      'The Subspace Theory': 'https://yannig.bandcamp.com/album/the-subspace-theory-ep',
      'Nightmare In Heaven': 'https://yannig.bandcamp.com/track/nightmare-in-heaven',
      'Galaxy 604': 'https://yannig.bandcamp.com/track/galaxy-604-goaep604-goa-records',
      'Psychedelic Goa Trance 2026: 100 Aliens':
        'https://freshfrequencies.bandcamp.com/album/psychedelic-goa-trance-2026-100-aliens',
      'The Call Of Goa, Vol. 5':
        'https://timewarprecords.bandcamp.com/album/the-call-of-goa-vol-5',
      'Psy Trance 2026: Space DJ':
        'https://open.spotify.com/album/73EV8DxuOgSoAhqSXSYhwn?si=NOD-pJajTYKP-Yr6trlgqg',
    };

    for (const [title, href] of Object.entries(expected)) {
      const link = screen.getByRole('link', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });

  it('renders a row without a url as non-interactive (no anchor)', () => {
    render(<SignalLog rows={{ solo: [{ date: '2099', title: 'Unlinked Test Release', meta: 'Single' }], comps: [] }} />);
    expect(screen.getByText(/unlinked test release/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /unlinked test release/i })).not.toBeInTheDocument();
  });
});