import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HeroSection from './HeroSection';

describe('HeroSection', () => {
  it('renders without crashing', () => {
    render(<HeroSection />);
  });

  it('has h1 with artist name', () => {
    render(<HeroSection />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent(/subspace resonator/i);
  });

  it('has LISTEN CTA linking to #music', () => {
    render(<HeroSection />);
    const link = screen.getByRole('link', { name: /scroll to music/i });
    expect(link).toHaveAttribute('href', '#music');
  });
});
