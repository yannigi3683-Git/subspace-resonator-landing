import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EntryGate } from './EntryGate';
import { makeSupabaseFake } from '../test-utils';

describe('EntryGate', () => {
  let supabase: ReturnType<typeof makeSupabaseFake>;
  const onEntry = vi.fn();

  beforeEach(() => {
    supabase = makeSupabaseFake();
    onEntry.mockClear();
    localStorage.clear();
  });

  it('renders heading and avatar grid', () => {
    render(<EntryGate supabase={supabase as never} onEntry={onEntry} />);
    expect(screen.getByText('SUBSPACE RADIO LIVE')).toBeInTheDocument();
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(12);
  });

  it('TUNE IN is disabled until avatar selected', async () => {
    render(<EntryGate supabase={supabase as never} onEntry={onEntry} />);
    const btn = screen.getByRole('button', { name: /TUNE IN/i });
    expect(btn).toBeDisabled();
  });

  it('TUNE IN enables after avatar selected (captcha auto-fires in test env)', async () => {
    render(<EntryGate supabase={supabase as never} onEntry={onEntry} />);
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[0]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /TUNE IN/i })).not.toBeDisabled();
    });
  });

  it('calls onEntry with identity and uid on success', async () => {
    render(<EntryGate supabase={supabase as never} onEntry={onEntry} />);
    fireEvent.click(screen.getAllByRole('radio')[0]);
    const btn = await screen.findByRole('button', { name: /TUNE IN/i });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    await waitFor(() => {
      expect(onEntry).toHaveBeenCalledTimes(1);
      const [identity, uid] = onEntry.mock.calls[0];
      expect(typeof identity.name).toBe('string');
      expect(typeof identity.avatarId).toBe('string');
      expect(uid).toBe('test-uid');
    });
  });

  it('shows error when signInAnonymously fails', async () => {
    supabase.auth.signInAnonymously = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Rate limit exceeded' },
    });
    render(<EntryGate supabase={supabase as never} onEntry={onEntry} />);
    fireEvent.click(screen.getAllByRole('radio')[0]);
    const btn = await screen.findByRole('button', { name: /TUNE IN/i });
    await waitFor(() => expect(btn).not.toBeDisabled());
    fireEvent.click(btn);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Rate limit exceeded');
    });
    expect(onEntry).not.toHaveBeenCalled();
  });
});
