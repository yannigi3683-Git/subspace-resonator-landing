import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpectrumAnalyzer from './SpectrumAnalyzer';

describe('SpectrumAnalyzer', () => {
  it('renders without crashing', () => {
    const { container } = render(<SpectrumAnalyzer />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders 32 bars', () => {
    const { container } = render(<SpectrumAnalyzer />);
    const bars = container.querySelectorAll('[data-bar]');
    expect(bars).toHaveLength(32);
  });

  it('renders static bars at 40% when prefers-reduced-motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList);
    const { container } = render(<SpectrumAnalyzer />);
    const bars = container.querySelectorAll('[data-bar]');
    expect(bars.length).toBe(32);
    bars.forEach((bar) => {
      expect((bar as HTMLElement).style.height).toBe('40%');
    });
  });
});
