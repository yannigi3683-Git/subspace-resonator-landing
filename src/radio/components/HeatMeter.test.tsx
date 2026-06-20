import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeatMeter } from './HeatMeter';
import { HEAT_COOL, HEAT_HOT } from '../heatMeter';

describe('HeatMeter', () => {
  it('renders the gauge with cool/hot vote buttons', () => {
    render(<HeatMeter heat={0.5} myVote={null} vote={vi.fn()} />);
    expect(screen.getByTestId('heat-meter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vote cool/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vote hot/i })).toBeInTheDocument();
  });

  it('casts cool and hot votes', () => {
    const vote = vi.fn();
    render(<HeatMeter heat={0.5} myVote={null} vote={vote} />);
    fireEvent.click(screen.getByRole('button', { name: /vote cool/i }));
    expect(vote).toHaveBeenCalledWith(HEAT_COOL);
    fireEvent.click(screen.getByRole('button', { name: /vote hot/i }));
    expect(vote).toHaveBeenCalledWith(HEAT_HOT);
  });

  it('reflects the crowd heat in the accessible label', () => {
    render(<HeatMeter heat={0.8} myVote={HEAT_HOT} vote={vi.fn()} />);
    expect(screen.getByRole('img', { name: /heat 80 percent/i })).toBeInTheDocument();
  });
});
