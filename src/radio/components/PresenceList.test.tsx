import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('PresenceList rename', () => {
  it('shows pencil button only on own entry when uid provided', () => {
    render(
      <PresenceList presenceList={[makeEntry(1), makeEntry(2)]} count={2} uid="uid-1" onRename={() => {}} />
    );
    expect(screen.getAllByRole('button', { name: /edit your identity/i })).toHaveLength(1);
  });

  it('clicking pencil shows edit form', () => {
    render(
      <PresenceList presenceList={[makeEntry(1)]} count={1} uid="uid-1" onRename={() => {}} />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit your identity/i }));
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('save with valid name calls onRename and closes form', () => {
    const onRename = vi.fn();
    render(
      <PresenceList presenceList={[makeEntry(1)]} count={1} uid="uid-1" onRename={onRename} />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit your identity/i }));
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'NewName' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onRename).toHaveBeenCalledWith('NewName', 'nebula');
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('save with short name shows error and does not call onRename', () => {
    const onRename = vi.fn();
    render(
      <PresenceList presenceList={[makeEntry(1)]} count={1} uid="uid-1" onRename={onRename} />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit your identity/i }));
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.getByText(/at least 2/i)).toBeInTheDocument();
  });

  it('cancel closes form without calling onRename', () => {
    const onRename = vi.fn();
    render(
      <PresenceList presenceList={[makeEntry(1)]} count={1} uid="uid-1" onRename={onRename} />
    );
    fireEvent.click(screen.getByRole('button', { name: /edit your identity/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  describe('moderation', () => {
    const mod = () => ({ onKick: vi.fn(), onBan: vi.fn() });

    it('shows no kick or ban to a normal listener', () => {
      render(<PresenceList presenceList={[makeEntry(1)]} count={1} uid="uid-2" />);
      expect(screen.queryByRole('button', { name: /kick/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^ban/i })).not.toBeInTheDocument();
    });

    it('kicks a listener who never typed', () => {
      const m = mod();
      const entry = { ...makeEntry(1), deviceId: 'dev-1' };
      render(<PresenceList presenceList={[entry]} count={1} uid="uid-2" moderation={m} />);
      fireEvent.click(screen.getByRole('button', { name: /kick listener1/i }));
      expect(m.onKick).toHaveBeenCalledWith(entry);
    });

    it('requires a second tap to ban', () => {
      const m = mod();
      const entry = { ...makeEntry(1), deviceId: 'dev-1' };
      render(<PresenceList presenceList={[entry]} count={1} uid="uid-2" moderation={m} />);

      fireEvent.click(screen.getByRole('button', { name: /^ban listener1/i }));
      expect(m.onBan).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /confirm ban for listener1/i }));
      expect(m.onBan).toHaveBeenCalledWith(entry);
    });

    // Your own entry is rendered separately (with the rename pencil), so it can never be a
    // kick/ban target from this list.
    it('never offers moderation on your own entry', () => {
      const m = mod();
      render(<PresenceList presenceList={[makeEntry(1)]} count={1} uid="uid-1" moderation={m} />);
      expect(screen.queryByRole('button', { name: /kick/i })).not.toBeInTheDocument();
    });
  });
});
