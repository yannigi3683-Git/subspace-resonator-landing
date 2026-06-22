import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PsyViz } from './PsyViz';

describe('PsyViz', () => {
  it('renders a decorative canvas', () => {
    const { container } = render(<PsyViz />);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
  });
});
