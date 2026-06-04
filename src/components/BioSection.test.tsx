import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BioSection from './BioSection';

describe('BioSection', () => {
  it('renders without crashing', () => {
    render(<BioSection />);
    expect(screen.getByRole('region', { name: /bio/i })).toBeInTheDocument();
  });

  it('has id="bio"', () => {
    render(<BioSection />);
    expect(document.getElementById('bio')).toBeInTheDocument();
  });

  it('shows all three signal sub-sections', () => {
    render(<BioSection />);
    const headings = screen.getAllByText(/the signal/i);
    expect(headings.length).toBeGreaterThan(0);
    expect(screen.getAllByText(/the reactivation/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/the mission/i).length).toBeGreaterThan(0);
  });

  it('bio watermark is aria-hidden', () => {
    const { container } = render(<BioSection />);
    const hidden = container.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThan(0);
  });
});
