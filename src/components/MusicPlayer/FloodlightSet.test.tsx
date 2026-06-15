import { render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import FloodlightSet from './FloodlightSet';

const mockReducedMotion = (reduce: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? reduce : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList);

describe('FloodlightSet', () => {
  afterEach(() => vi.restoreAllMocks());

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

  it('animates while playing when reduced motion is NOT preferred', () => {
    mockReducedMotion(false);
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(0);
    render(<FloodlightSet playing side="left" />);
    expect(raf).toHaveBeenCalled();
  });

  it('does not start the animation loop when reduced motion is preferred', () => {
    mockReducedMotion(true);
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(0);
    const { container } = render(<FloodlightSet playing side="left" />);
    expect(raf).not.toHaveBeenCalled();
    expect(container.querySelectorAll('[data-cabinet]').length).toBeGreaterThan(0);
  });
});
