import { useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TurnstileWidget } from '../components/TurnstileWidget';

interface Props {
  supabase: SupabaseClient;
  onAuthenticated: (client: SupabaseClient) => void;
}

type Phase = 'password' | 'enroll' | 'totp';

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
  // Authenticator (TOTP) state.
  const [activeFactorId, setActiveFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');

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
      await proceedAfterPassword();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AdminGate] sign-in error:', err);
      setErrorMsg(`Error: ${msg}`);
      refreshCaptcha();
    } finally {
      setBusy(false);
    }
  }

  // After the password succeeds: use an existing authenticator if one is set up,
  // otherwise start enrolling a new one (shows a QR code to scan).
  async function proceedAfterPassword() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    const existing = data?.totp?.[0];
    if (existing) {
      setActiveFactorId(existing.id);
      setPhase('totp');
      return;
    }
    // Clear any half-finished (unverified) factors so a fresh enroll doesn't conflict.
    for (const f of data?.all ?? []) {
      if (f.status === 'unverified') {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
    }
    const { data: enrollData, error: enrollErr } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Subspace Radio',
    });
    if (enrollErr || !enrollData) {
      setErrorMsg(enrollErr?.message ?? 'Could not start authenticator setup.');
      return;
    }
    setActiveFactorId(enrollData.id);
    setQrCode(enrollData.totp.qr_code);
    setSecret(enrollData.totp.secret);
    setPhase('enroll');
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrorMsg('');
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: activeFactorId,
        code: totpCode.replace(/\s/g, ''),
      });
      if (error) {
        setErrorMsg(error.message);
        return;
      }
      onAuthenticated(supabase);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AdminGate] verify error:', err);
      setErrorMsg(`Error: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  const qrSrc = qrCode.startsWith('data:')
    ? qrCode
    : `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`;

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
            {/* Best-effort captcha: produces a token where the domain is allow-listed
                (production). On preview/unlisted domains it can't run, so we never block
                the button on it. If the project requires captcha, the server returns a
                clear error; for preview testing, captcha can be disabled in Supabase. */}
            <TurnstileWidget key={captchaKey} onToken={setCaptchaToken} />
            <button
              type="submit"
              disabled={busy}
              className="mt-2 font-mono text-xs tracking-widest border border-primary px-4 min-h-[44px] hover:bg-primary/10 disabled:opacity-40 transition-colors"
            >
              {busy ? 'CHECKING...' : 'CONTINUE'}
            </button>
          </form>
        )}

        {phase === 'enroll' && (
          <form onSubmit={verifyCode} className="flex flex-col gap-4" data-testid="enroll-form">
            <p className="font-mono text-xs text-muted-foreground leading-relaxed">
              Set up your authenticator. Install an authenticator app (Google Authenticator,
              Authy, or similar), scan the code below, then enter the 6-digit code it shows.
            </p>
            {qrSrc && (
              <img
                src={qrSrc}
                alt="Authenticator setup QR code"
                className="w-44 h-44 self-center bg-white p-2 rounded"
              />
            )}
            {secret && (
              <p className="font-mono text-[11px] text-muted-foreground break-all">
                Can&apos;t scan? Enter this key manually:
                <br />
                <span className="text-foreground select-all">{secret}</span>
              </p>
            )}
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
                6-DIGIT CODE
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
              {busy ? 'VERIFYING...' : 'VERIFY & FINISH SETUP'}
            </button>
          </form>
        )}

        {phase === 'totp' && (
          <form onSubmit={verifyCode} className="flex flex-col gap-4">
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
