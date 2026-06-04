import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Knob from './Knob';

describe('Knob', () => {
  it('renders without crashing', () => {
    render(<Knob label="VOL" value={50} onChange={vi.fn()} />);
  });

  it('has role=slider', () => {
    render(<Knob label="VOL" value={50} onChange={vi.fn()} />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('has aria-valuemin, aria-valuemax, aria-valuenow', () => {
    render(<Knob label="VOL" value={50} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
  });

  it('ArrowUp increases value by 5', () => {
    const onChange = vi.fn();
    render(<Knob label="VOL" value={50} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(55);
  });

  it('ArrowDown decreases value by 5', () => {
    const onChange = vi.fn();
    render(<Knob label="VOL" value={50} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(45);
  });

  it('clamps at 0 and 100', () => {
    const onChange = vi.fn();
    render(<Knob label="VOL" value={0} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
