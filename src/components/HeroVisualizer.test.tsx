import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HeroVisualizer from './HeroVisualizer';

describe('HeroVisualizer', () => {
  let matchMediaSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList);
  });

  afterEach(() => {
    matchMediaSpy?.mockRestore();
  });

  it('renders without crashing', () => {
    const { container } = render(<HeroVisualizer />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders a canvas element', () => {
    const { container } = render(<HeroVisualizer />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });
});
