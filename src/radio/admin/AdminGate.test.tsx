import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AdminGate from './AdminGate';
import type { SupabaseClient } from '@supabase/supabase-js';

function makeSupabase(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
      mfa: {
        listFactors: vi.fn().mockResolvedValue({ data: { totp: [{ id: 'factor-1' }], all: [] } }),
        challengeAndVerify: vi.fn().mockResolvedValue({ error: null }),
        enroll: vi.fn().mockResolvedValue({
          data: { id: 'new-factor', totp: { qr_code: '<svg></svg>', secret: 'ABC123SECRET' } },
        }),
        unenroll: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    },
    ...overrides,
  } as unknown as SupabaseClient;
}

describe('AdminGate', () => {
  it('renders the password form initially', () => {
    render(<AdminGate supabase={makeSupabase()} onAuthenticated={vi.fn()} />);
    expect(screen.getByTestId('admin-gate')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('shows TOTP form after successful password sign-in', async () => {
    const supabase = makeSupabase();
    render(<AdminGate supabase={supabase} onAuthenticated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'host@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/authenticator code/i)).toBeInTheDocument();
    });
  });

  it('shows authenticator setup (QR + secret) when no factor is enrolled yet', async () => {
    const supabase = makeSupabase();
    (supabase.auth.mfa.listFactors as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { totp: [], all: [] },
    });
    render(<AdminGate supabase={supabase} onAuthenticated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'host@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByTestId('enroll-form')).toBeInTheDocument();
      expect(screen.getByText('ABC123SECRET')).toBeInTheDocument();
    });
    expect(supabase.auth.mfa.enroll).toHaveBeenCalled();
  });

  it('shows an error message on wrong password', async () => {
    const supabase = makeSupabase();
    (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: { message: 'Invalid credentials' },
    });

    render(<AdminGate supabase={supabase} onAuthenticated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'x@x.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
    });
  });

  it('calls onAuthenticated after successful TOTP', async () => {
    const onAuthenticated = vi.fn();
    const supabase = makeSupabase();
    render(<AdminGate supabase={supabase} onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'h@h.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => screen.getByLabelText(/authenticator code/i));

    fireEvent.change(screen.getByLabelText(/authenticator code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(supabase));
  });

  it('shows error on wrong TOTP code', async () => {
    const supabase = makeSupabase();
    (supabase.auth.mfa.challengeAndVerify as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: { message: 'Invalid code' },
    });

    render(<AdminGate supabase={supabase} onAuthenticated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'h@h.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => screen.getByLabelText(/authenticator code/i));
    fireEvent.change(screen.getByLabelText(/authenticator code/i), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid code');
    });
  });

  it('CONTINUE button is disabled while request is in flight', async () => {
    const supabase = makeSupabase();
    let resolve!: () => void;
    (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockReturnValue(
      new Promise((r) => { resolve = () => r({ error: null }); }),
    );

    render(<AdminGate supabase={supabase} onAuthenticated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'h@h.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByRole('button', { name: /checking/i })).toBeDisabled();
    resolve();
  });
});
