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
});
