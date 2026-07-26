import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Chat } from './Chat';
import type { ChatMessage } from '../types';

const makeMsg = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: '1',
  uid: 'uid-1',
  display_name: 'Alice',
  avatar_id: 'nebula',
  body: 'Hello!',
  is_host: false,
  created_at: '2026-01-01T12:00:00Z',
  ...overrides,
});

describe('Chat', () => {
  it('renders messages', () => {
    render(<Chat messages={[makeMsg()]} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Hello!')).toBeInTheDocument();
  });

  it('shows HOST badge for host messages', () => {
    render(<Chat messages={[makeMsg({ is_host: true })]} />);
    expect(screen.getByText('HOST')).toBeInTheDocument();
  });

  it('does NOT show HOST badge for non-host messages', () => {
    render(<Chat messages={[makeMsg({ is_host: false })]} />);
    expect(screen.queryByText('HOST')).not.toBeInTheDocument();
  });

  it('XSS: renders HTML payload as literal text, not HTML', () => {
    const xssBody = '<img src=x onerror=alert(1)>';
    render(<Chat messages={[makeMsg({ body: xssBody })]} />);
    expect(screen.getByText(xssBody)).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('renders a quoted reply stub when reply_to fields are present', () => {
    render(<Chat messages={[makeMsg({ reply_to_name: 'Bob', reply_to_body: 'earlier point' })]} />);
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('earlier point')).toBeInTheDocument();
  });

  it('shows a Reply affordance only when onReply is provided', () => {
    const { rerender } = render(<Chat messages={[makeMsg()]} />);
    expect(screen.queryByLabelText('Reply to Alice')).toBeNull();
    rerender(<Chat messages={[makeMsg()]} onReply={() => {}} />);
    expect(screen.getByLabelText('Reply to Alice')).toBeInTheDocument();
  });

  it('renders reaction pills with counts when reactions are provided', () => {
    render(
      <Chat
        messages={[makeMsg({ id: 'm1' })]}
        onToggleReaction={() => {}}
        reactions={{ m1: [{ emoji: '🔥', count: 3, mine: false }] }}
      />,
    );
    expect(screen.getByText('🔥')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders multiple messages', () => {
    render(
      <Chat
        messages={[
          makeMsg({ id: '1', display_name: 'Alice', body: 'Hi' }),
          makeMsg({ id: '2', display_name: 'Bob', body: 'Hey' }),
        ]}
      />,
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  describe('moderation', () => {
    const mod = () => ({ onDelete: vi.fn(), onKick: vi.fn(), onBan: vi.fn() });

    // The whole point of "blend in": a listener's DOM must not contain these controls.
    it('renders no moderation control without the prop', () => {
      render(<Chat messages={[makeMsg()]} />);
      expect(screen.queryByTestId('moderate-message')).not.toBeInTheDocument();
    });

    it('offers a moderation control per message when moderating', () => {
      render(<Chat messages={[makeMsg()]} moderation={mod()} />);
      expect(screen.getByTestId('moderate-message')).toBeInTheDocument();
    });

    it('keeps the actions collapsed until the control is tapped', () => {
      render(<Chat messages={[makeMsg()]} moderation={mod()} />);
      expect(screen.queryByText('DELETE MESSAGE')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('moderate-message'));
      expect(screen.getByText('DELETE MESSAGE')).toBeInTheDocument();
    });

    it('deletes the message it was opened from', () => {
      const m = mod();
      const msg = makeMsg({ id: 'msg-9' });
      render(<Chat messages={[msg]} moderation={m} />);
      fireEvent.click(screen.getByTestId('moderate-message'));
      fireEvent.click(screen.getByText('DELETE MESSAGE'));
      expect(m.onDelete).toHaveBeenCalledWith(msg);
    });

    it('kicks in one tap', () => {
      const m = mod();
      render(<Chat messages={[makeMsg()]} moderation={m} />);
      fireEvent.click(screen.getByTestId('moderate-message'));
      fireEvent.click(screen.getByText(/KICK Alice/));
      expect(m.onKick).toHaveBeenCalled();
    });

    // Ban is irreversible from the listener's side, so a single mis-tap must not fire it.
    it('requires a second tap to ban', () => {
      const m = mod();
      render(<Chat messages={[makeMsg()]} moderation={m} />);
      fireEvent.click(screen.getByTestId('moderate-message'));
      fireEvent.click(screen.getByText(/BAN Alice/));
      expect(m.onBan).not.toHaveBeenCalled();

      fireEvent.click(screen.getByText('TAP AGAIN TO BAN'));
      expect(m.onBan).toHaveBeenCalled();
    });

    it('disarms the ban confirmation when the panel is reopened', () => {
      const m = mod();
      render(<Chat messages={[makeMsg()]} moderation={m} />);
      fireEvent.click(screen.getByTestId('moderate-message'));
      fireEvent.click(screen.getByText(/BAN Alice/));
      fireEvent.click(screen.getByTestId('moderate-message')); // close
      fireEvent.click(screen.getByTestId('moderate-message')); // reopen
      expect(screen.getByText(/BAN Alice/)).toBeInTheDocument();
      expect(m.onBan).not.toHaveBeenCalled();
    });
  });
});
