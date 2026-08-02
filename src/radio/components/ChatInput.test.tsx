import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from './ChatInput';

const base = {
  onSend: async () => {},
  sending: false,
  sendError: null,
};

// The cheer lives in the composer rather than on the avatar because at crowd scale a floor tile
// is near the 16px minimum, well under the project's 44px touch-target rule. That reasoning only
// holds if the button here actually meets 44px.
describe('ChatInput cheer button', () => {
  it('is absent when the room does not pass a cheer handler', () => {
    render(<ChatInput {...base} />);
    expect(screen.queryByTestId('cheer-btn')).not.toBeInTheDocument();
  });

  it('calls onCheer when tapped', () => {
    const onCheer = vi.fn();
    render(<ChatInput {...base} onCheer={onCheer} />);
    fireEvent.click(screen.getByTestId('cheer-btn'));
    expect(onCheer).toHaveBeenCalledTimes(1);
  });

  it('meets the 44px touch target', () => {
    render(<ChatInput {...base} onCheer={() => {}} />);
    const btn = screen.getByTestId('cheer-btn');
    expect(btn.className).toContain('min-w-[44px]');
    expect(btn.className).toContain('min-h-[44px]');
  });

  // A locked chat silences typing, not the room's mood, and a cheer carries no text to moderate.
  it('stays available while the composer is disabled', () => {
    const onCheer = vi.fn();
    render(<ChatInput {...base} disabled onCheer={onCheer} />);
    const btn = screen.getByTestId('cheer-btn');
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onCheer).toHaveBeenCalledTimes(1);
  });
});
