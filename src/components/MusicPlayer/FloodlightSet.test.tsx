import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FloodlightSet from './FloodlightSet';

describe('FloodlightSet', () => {
  it('renders without crashing', () => {
    const { container } = render(<FloodlightSet />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders 4 cabinets', () => {
    const { container } = render(<FloodlightSet />);
    const cabinets = container.querySelectorAll('[data-cabinet]');
    expect(cabinets).toHaveLength(4);
  });

  it('is aria-hidden', () => {
    const { container } = render(<FloodlightSet />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
