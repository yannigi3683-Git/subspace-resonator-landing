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
    expect(screen.getByText(/^releases$/i)).toBeInTheDocument();
    expect(screen.getByText(/compilation appearances/i)).toBeInTheDocument();
  });

  it('lists all six confirmed releases', () => {
    render(<SignalLog />);
    expect(screen.getByText(/the subspace theory/i)).toBeInTheDocument();
    expect(screen.getByText(/nightmare in heaven/i)).toBeInTheDocument();
    expect(screen.getAllByText(/galaxy 604/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/100 aliens/i)).toBeInTheDocument();
    expect(screen.getByText(/the call of goa, vol\. 5/i)).toBeInTheDocument();
    expect(screen.getByText(/psy trance 2026 space dj/i)).toBeInTheDocument();
  });

  it('links each release to its release page in a new tab', () => {
    render(<SignalLog />);
    const expected: Record<string, string> = {
      'The Subspace Theory': 'https://yannig.bandcamp.com/album/the-subspace-theory-ep',
      'Nightmare In Heaven': 'https://yannig.bandcamp.com/track/nightmare-in-heaven',
      'Psychedelic Goa Trance 2026 100 Aliens':
        'https://freshfrequencies.bandcamp.com/album/psychedelic-goa-trance-2026-100-aliens',
      'The Call Of Goa, Vol. 5':
        'https://timewarprecords.bandcamp.com/album/the-call-of-goa-vol-5',
      'Psy Trance 2026 Space DJ':
        'https://open.spotify.com/album/73EV8DxuOgSoAhqSXSYhwn?si=NOD-pJajTYKP-Yr6trlgqg',
    };

    for (const [title, href] of Object.entries(expected)) {
      const link = screen.getByRole('link', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    }
  });

  it('renders Galaxy 604 as non-interactive (no URL)', () => {
    render(<SignalLog />);
    expect(screen.getAllByText(/galaxy 604/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /galaxy 604, open release/i })).not.toBeInTheDocument();
  });

  it('renders a row without a url as non-interactive (no anchor)', () => {
    render(<SignalLog rows={{ solo: [{ id: 'test-1', date: '2099', title: 'Unlinked Test Release', kind: 'Single', label: 'Test Label' }], comps: [] }} />);
    expect(screen.getByText(/unlinked test release/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /unlinked test release/i })).not.toBeInTheDocument();
  });

  it('renders releases newest-first regardless of input order', () => {
    render(<SignalLog rows={{
      solo: [
        { id: 'older', date: '2020-01-01', title: 'Older Release', kind: 'Single', label: 'L', url: 'https://example.com/older' },
        { id: 'newest', date: '2025-12-26', title: 'Newest Release', kind: 'Single', label: 'L', url: 'https://example.com/newest' },
        { id: 'mid', date: '2023-06-01', title: 'Middle Release', kind: 'Single', label: 'L', url: 'https://example.com/mid' },
      ],
      comps: [],
    }} />);
    const order = screen.getAllByRole('link').map(l => l.getAttribute('aria-label'));
    expect(order[0]).toMatch(/newest release/i);
    expect(order[1]).toMatch(/middle release/i);
    expect(order[2]).toMatch(/older release/i);
  });
});
