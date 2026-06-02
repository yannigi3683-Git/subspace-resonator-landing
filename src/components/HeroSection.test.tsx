import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HeroSection from './HeroSection';

describe('HeroSection', () => {
  it('renders without crashing', () => {
    render(<HeroSection />);
  });

  it('has h1 with SUBSPACE RESONATOR', () => {
    render(<HeroSection />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SUBSPACE RESONATOR');
  });

  it('has BOOK FOR YOUR EVENT CTA linking to #contact', () => {
    render(<HeroSection />);
    const link = screen.getByRole('link', { name: /book for your event/i });
    expect(link).toHaveAttribute('href', '#contact');
  });

  it('has LISTEN CTA linking to #music', () => {
    render(<HeroSection />);
    const link = screen.getByRole('link', { name: /listen/i });
    expect(link).toHaveAttribute('href', '#music');
  });
});
