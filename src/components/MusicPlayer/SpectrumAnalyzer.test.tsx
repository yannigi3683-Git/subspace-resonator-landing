import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SpectrumAnalyzer from './SpectrumAnalyzer';

describe('SpectrumAnalyzer', () => {
  it('renders without crashing', () => {
    const { container } = render(<SpectrumAnalyzer />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders 14 frequency bands', () => {
    const { container } = render(<SpectrumAnalyzer />);
    const bars = container.querySelectorAll('[data-bar]');
    expect(bars).toHaveLength(14);
  });
});
