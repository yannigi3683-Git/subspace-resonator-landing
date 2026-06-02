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
    expect(screen.getByText(/THE SIGNAL/i)).toBeInTheDocument();
    expect(screen.getByText(/THE REACTIVATION/i)).toBeInTheDocument();
    expect(screen.getByText(/THE MISSION/i)).toBeInTheDocument();
  });

  it('has BOOK CTA linking to #contact', () => {
    render(<BioSection />);
    const link = screen.getByRole('link', { name: /book subspace resonator/i });
    expect(link).toHaveAttribute('href', '#contact');
  });

  it('bio watermark image is aria-hidden', () => {
    render(<BioSection />);
    const imgs = document.querySelectorAll('img[aria-hidden="true"]');
    expect(imgs.length).toBeGreaterThan(0);
  });
});
