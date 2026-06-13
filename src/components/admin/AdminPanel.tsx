import { useEffect, useRef, useState } from 'react';
import { Lock, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type PanelState = 'checking' | 'sign-in' | 'not-admin' | 'ready';

const AdminPanel = () => {
  const [open, setOpen]   = useState(false);
  const [panel, setPanel] = useState<PanelState>('checking');
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [error, setError] = useState('');
  const [busy,  setBusy]  = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  const verify = async () => {
    if (!supabase) { setPanel('sign-in'); return; }
    setPanel('checking');
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) { setPanel('sign-in'); return; }
    const { data, error } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
    setPanel(!error && data === true ? 'ready' : 'not-admin');
  };

  useEffect(() => { if (open) verify(); }, [open]);

  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => { if (open) verify(); });
    return () => sub.subscription.unsubscribe();
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open && panel === 'sign-in') emailRef.current?.focus();
  }, [open, panel]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError('');
    setBusy(true);
    try {
      const url = import.meta.env.VITE_SUPABASE_URL as string;
      // Strip BOM/non-ASCII that PowerShell UTF-16 encoding may prepend to env vars
      const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string).replace(/[^\x20-\x7E]/g, '');
      const body = await new Promise<{ status: number; data: Record<string, string> }>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `${url}/auth/v1/token?grant_type=password`);
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.setRequestHeader('apikey', key);
          xhr.setRequestHeader('Authorization', `Bearer ${key}`);
          xhr.timeout = 15000;
          xhr.onload = () => {
            try { resolve({ status: xhr.status, data: JSON.parse(xhr.responseText) }); }
            catch { reject(new Error(`Unexpected response (HTTP ${xhr.status})`)); }
          };
          xhr.onerror = () => reject(new Error('Network error — check connection'));
          xhr.ontimeout = () => reject(new Error('Timed out — Supabase project may be paused'));
          xhr.send(JSON.stringify({ email: email.trim(), password: pass }));
        }
      );
      if (body.status !== 200) {
        setError(body.data.error_description || body.data.msg || body.data.message || `Error ${body.status}`);
        return;
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: body.data.access_token,
        refresh_token: body.data.refresh_token,
      });
      if (sessionError) setError(sessionError.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err) || 'Network error');
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setPanel('sign-in');
    setEmail('');
    setPass('');
  };

  if (!open) return null;

  return (
    <>
      {panel === 'ready' && (
        <div className="fixed bottom-2 left-2 z-[70] border border-primary bg-background px-2 py-1 text-[9px] tracking-[0.2em] uppercase text-primary pointer-events-none">
          ADMIN MODE
        </div>
      )}

      <div className="fixed inset-y-0 right-0 z-[80] w-full sm:w-[420px] bg-background border-l border-border flex flex-col font-mono">
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="text-xs tracking-[0.3em] text-primary uppercase">// ADMIN CONSOLE</div>
          <button onClick={() => setOpen(false)} className="p-1 hover:text-primary" aria-label="Close admin panel">
            <X size={16} />
          </button>
        </div>

        {panel === 'checking' && (
          <div className="p-4 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">VERIFYING...</div>
        )}

        {panel === 'sign-in' && (
          <form onSubmit={signIn} className="p-4 space-y-3">
            <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">ADMIN SESSION REQUIRED</div>
            <div className="space-y-2">
              <input
                ref={emailRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Password"
                required
                className="w-full border border-border bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            {error && <p className="text-[10px] text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full border border-primary text-primary py-2 text-xs tracking-[0.2em] uppercase hover:bg-primary/10 disabled:opacity-50"
            >
              {busy ? 'SIGNING IN...' : 'SIGN IN'}
            </button>
          </form>
        )}

        {panel === 'not-admin' && (
          <div className="p-4 space-y-3">
            <div className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">NOT AUTHORIZED</div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              This account does not have admin access. Sign out and try again with the correct account.
            </p>
            <button
              onClick={signOut}
              className="w-full border border-border py-2 text-xs tracking-[0.2em] uppercase hover:border-primary hover:text-primary flex items-center justify-center gap-1"
            >
              <Lock size={12} /> SIGN OUT
            </button>
          </div>
        )}

        {panel === 'ready' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-[10px] tracking-[0.2em] text-primary uppercase">EDITORS</div>
              {(['GIGS', 'GALLERY', 'BIO', 'BOOKING', 'SOCIALS', 'DISCOGRAPHY'] as const).map((name) => (
                <div
                  key={name}
                  className="border border-border px-3 py-2 text-[10px] tracking-[0.2em] text-muted-foreground uppercase"
                >
                  {name} — coming soon
                </div>
              ))}
            </div>
            <div className="border-t border-border p-3">
              <button
                onClick={signOut}
                className="w-full border border-border py-2 text-[10px] tracking-[0.2em] uppercase hover:border-primary hover:text-primary flex items-center justify-center gap-1"
              >
                <Lock size={12} /> SIGN OUT
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default AdminPanel;
