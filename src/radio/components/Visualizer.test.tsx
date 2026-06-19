import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Visualizer } from './Visualizer';

describe('Visualizer', () => {
  it('renders a decorative canvas and no-ops safely when 2D context is unavailable', () => {
    const { container } = render(<Visualizer getFrequencyData={() => null} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
  });
});
