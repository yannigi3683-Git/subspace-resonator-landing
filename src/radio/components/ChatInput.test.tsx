import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatInput } from './ChatInput';

const base = {
  onSend: async () => {},
  sending: false,
  sendError: null,
};

// The cheer moved to the stage (LiveRoom), beside the volume, so the composer must not carry it.
describe('ChatInput', () => {
  it('has no cheer button', () => {
    render(<ChatInput {...base} />);
    expect(screen.queryByTestId('cheer-btn')).not.toBeInTheDocument();
  });
});
