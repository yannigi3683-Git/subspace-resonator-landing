import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Footer from './Footer';

describe('Footer', () => {
  it('renders without crashing', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('contains copyright text', () => {
    render(<Footer />);
    expect(screen.getByText(/SUBSPACE RESONATOR/i)).toBeInTheDocument();
  });

  it('has booking email link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: /subspaceresonator@gmail.com/i });
    expect(link).toHaveAttribute('href', 'mailto:subspaceresonator@gmail.com');
  });

  it('has phone link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: /\+972/i });
    expect(link).toHaveAttribute('href', 'tel:+972507974184');
  });
});
