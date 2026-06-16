import { render } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import SpectrumAnalyzer from './SpectrumAnalyzer';

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

describe('SpectrumAnalyzer', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders without crashing', () => {
    const { container } = render(<SpectrumAnalyzer />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders 14 frequency bands', () => {
    const { container } = render(<SpectrumAnalyzer />);
    const bars = container.querySelectorAll('[data-bar]');
    expect(bars).toHaveLength(14);
  });

  it('animates while playing when reduced motion is NOT preferred', () => {
    mockReducedMotion(false);
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(0);
    render(<SpectrumAnalyzer playing label="CH-L" trackIndex={0} volume={70} />);
    expect(raf).toHaveBeenCalled();
  });

  it('does not start the animation loop when reduced motion is preferred', () => {
    mockReducedMotion(true);
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(0);
    const { container } = render(<SpectrumAnalyzer playing label="CH-L" trackIndex={0} volume={70} />);
    expect(raf).not.toHaveBeenCalled();
    expect(container.querySelectorAll('[data-bar]')).toHaveLength(14);
  });
});
