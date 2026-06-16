import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TurnstileWidget } from '../components/TurnstileWidget';

interface Props {
  supabase: SupabaseClient;
  onAuthenticated: (client: SupabaseClient) => void;
}

type Phase = 'password' | 'totp';

export default function AdminGate({ supabase, onAuthenticated }: Props) {
  const [phase, setPhase] = useState<Phase>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  // Turnstile tokens are single-use; bumping this key remounts the widget to get a fresh one after a failed attempt.
  const [captchaKey, setCaptchaKey] = useState(0);

  function refreshCaptcha() {
    setCaptchaToken('');
    setCaptchaKey((k) => k + 1);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      });
      if (error) {
        setErrorMsg(error.message);
        refreshCaptcha();
        return;
      }
      setPhase('totp');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AdminGate] sign-in error:', err);
      setErrorMsg(`Error: ${msg}`);
      refreshCaptcha();
    } finally {
      setBusy(false);
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: await getFactorId(),
        code: totpCode.replace(/\s/g, ''),
      });
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      onAuthenticated(supabase);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AdminGate] TOTP error:', err);
      setErrorMsg(`Error: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  async function getFactorId(): Promise<string> {
    const { data } = await supabase.auth.mfa.listFactors();
    const totp = data?.totp?.[0];
    if (!totp) throw new Error('No TOTP factor enrolled on this account');
    return totp.id;
  }

  return (
    <main
      className="min-h-screen bg-background text-foreground flex items-center justify-center px-4"
      data-testid="admin-gate"
    >
      <section className="section-border max-w-sm w-full p-8">
        <p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground">
          // SUBSPACE RADIO LIVE
        </p>
        <h1 className="font-display text-2xl mt-3 mb-6">BROADCAST ACCESS</h1>

        {phase === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
                EMAIL
              </span>
              <input
                type="email"
                autoComplete="username"
                required
                aria-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent border border-border rounded px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
                PASSWORD
              </span>
              <input
                type="password"
                autoComplete="current-password"
                required
                aria-label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent border border-border rounded px-3 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
              />
            </label>
            {errorMsg && (
              <p role="alert" className="font-mono text-xs text-destructive">
                {errorMsg}
              </p>
            )}
            <TurnstileWidget
              key={captchaKey}
              onToken={setCaptchaToken}
              onError={(msg) => setErrorMsg(msg)}
            />
            <button
              type="submit"
              disabled={busy || !captchaToken}
              className="mt-2 font-mono text-xs tracking-widest border border-primary px-4 min-h-[44px] hover:bg-primary/10 disabled:opacity-40 transition-colors"
            >
              {busy ? 'CHECKING...' : 'CONTINUE'}
            </button>
          </form>
        )}

        {phase === 'totp' && (
          <form onSubmit={handleTotpSubmit} className="flex flex-col gap-4">
            <p className="font-mono text-xs text-muted-foreground">
              Enter the 6-digit code from your authenticator app.
            </p>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
                AUTHENTICATOR CODE
              </span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                required
                aria-label="Authenticator Code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="bg-transparent border border-border rounded px-3 py-2 font-mono text-sm tracking-[0.5em] focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
              />
            </label>
            {errorMsg && (
              <p role="alert" className="font-mono text-xs text-destructive">
                {errorMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="mt-2 font-mono text-xs tracking-widest border border-primary px-4 min-h-[44px] hover:bg-primary/10 disabled:opacity-40 transition-colors"
            >
              {busy ? 'VERIFYING...' : 'AUTHENTICATE'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
