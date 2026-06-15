import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresenceList } from './PresenceList';
import type { PresenceEntry } from '../types';

const makeEntry = (n: number): PresenceEntry => ({
  uid: `uid-${n}`,
  name: `Listener${n}`,
  avatarId: 'nebula',
  position: { x: 50, y: 50 },
});

describe('PresenceList', () => {
  it('shows count 0 listeners', () => {
    render(<PresenceList presenceList={[]} count={0} />);
    expect(screen.getByText(/0 listeners online/i)).toBeInTheDocument();
  });

  it('shows singular "listener" for count 1', () => {
    render(<PresenceList presenceList={[makeEntry(1)]} count={1} />);
    expect(screen.getByText(/1 listener online/i)).toBeInTheDocument();
  });

  it('shows listener names', () => {
    render(
      <PresenceList presenceList={[makeEntry(1), makeEntry(2)]} count={2} />,
    );
    expect(screen.getByText('Listener1')).toBeInTheDocument();
    expect(screen.getByText('Listener2')).toBeInTheDocument();
  });

  it('truncates to 20 and shows overflow count', () => {
    const entries = Array.from({ length: 25 }, (_, i) => makeEntry(i + 1));
    render(<PresenceList presenceList={entries} count={25} />);
    expect(screen.getByText(/\+5 more/i)).toBeInTheDocument();
  });
});
