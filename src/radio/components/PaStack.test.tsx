import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaStack } from './PaStack';

describe('PaStack', () => {
  it('renders a labelled Floodlight stack (decorative, aria-hidden)', () => {
    render(<PaStack side="left" />);
    expect(screen.getByRole('img', { name: /floodlight speaker stack/i, hidden: true })).toBeInTheDocument();
  });

  it('is purely presentational - no playback props, renders both sides', () => {
    const { container: left } = render(<PaStack side="left" />);
    const { container: right } = render(<PaStack side="right" />);
    // Each stack is a single static SVG (no canvas, no audio surface).
    expect(left.querySelectorAll('svg')).toHaveLength(1);
    expect(right.querySelectorAll('svg')).toHaveLength(1);
  });
});
