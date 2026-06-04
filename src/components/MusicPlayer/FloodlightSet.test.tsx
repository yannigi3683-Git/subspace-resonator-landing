import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FloodlightSet from './FloodlightSet';

describe('FloodlightSet', () => {
  it('renders without crashing', () => {
    const { container } = render(<FloodlightSet />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders at least one cabinet', () => {
    const { container } = render(<FloodlightSet />);
    const cabinets = container.querySelectorAll('[data-cabinet]');
    expect(cabinets.length).toBeGreaterThan(0);
  });

  it('is aria-hidden', () => {
    const { container } = render(<FloodlightSet />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
