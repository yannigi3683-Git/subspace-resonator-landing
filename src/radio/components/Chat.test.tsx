import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
