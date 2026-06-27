import { useState, useCallback } from 'react';
import { Shuffle } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AVATARS, randomUniqueName } from '../avatars';
import { createIdentity, saveIdentity } from '../identity';
import type { Identity } from '../types';
import { TurnstileWidget } from './TurnstileWidget';
import { Avatar } from './Avatar';

interface EntryGateProps {
  supabase: SupabaseClient;
  onEntry: (identity: Identity, uid: string) => void;
}

export function EntryGate({ supabase, onEntry }: EntryGateProps) {
  const [selectedAvatarId, setSelectedAvatarId] = useState('');
  const [name, setName] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Captcha is best-effort: it produces a token only where the domain is allow-listed
  // (production). On preview/unlisted domains it can't run, so don't block entry on it —
  // the token is still passed when present, and the server enforces captcha when required.
  const canSubmit = name.trim().length >= 2 && selectedAvatarId !== '';

  const handleTuneIn = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      // Reuse the existing anonymous session if there is one (a per-broadcast re-pick keeps the
      // same auth user), so we don't mint a new uid + anon user on every broadcast.
      let userId = (await supabase.auth.getSession()).data.session?.user?.id ?? '';
      if (!userId) {
        const { data, error: authError } = await supabase.auth.signInAnonymously({
          options: captchaToken ? { captchaToken } : {},
        });
        if (authError || !data.user) {
          setError(authError?.message ?? 'Sign-in failed. Try again.');
          return;
        }
        userId = data.user.id;
      }
      const identity = createIdentity(name.trim(), selectedAvatarId);
      saveIdentity(identity);
      onEntry(identity, userId);
    } catch {
      setError('Connection error. Check your network and try again.');
    } finally {
      setLoading(false);
    }
  }, [canSubmit, supabase, captchaToken, name, selectedAvatarId, onEntry]);

  return (
    <div className="min-h-screen bg-[#05060f] radio-nebula flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle aurora behind content */}
      <div className="absolute inset-x-0 top-0 h-1/3 radio-aurora pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-x-0 bottom-0 h-[30%] radio-floor-glow pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 w-full flex flex-col items-center">
        <h1 className="font-display text-white text-2xl sm:text-3xl font-bold tracking-[0.2em] mb-1"
          style={{ textShadow: '0 0 24px rgba(38,198,218,0.5)' }}>
          SUBSPACE RADIO
        </h1>
        <p className="font-mono text-[#26C6DA]/70 text-xs tracking-widest mb-8 uppercase">
          Choose your identity
        </p>

        {/* Avatar grid — SVG cosmic glyphs */}
        <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-8 w-full max-w-xs" role="radiogroup" aria-label="Avatar">
          {AVATARS.map((avatar) => {
            const selected = selectedAvatarId === avatar.id;
            return (
              <button
                key={avatar.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={avatar.label}
                onClick={() => setSelectedAvatarId(avatar.id)}
                className={`flex flex-col items-center gap-1.5 p-2 min-h-[72px] rounded-xl border transition-all duration-150 ${
                  selected
                    ? 'border-white/40 bg-white/10 scale-[1.06]'
                    : 'border-white/5 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/15'
                }`}
                style={selected ? { boxShadow: `0 0 14px ${avatar.color}55` } : undefined}
              >
                <Avatar avatarId={avatar.id} size={40} glow={selected} label={avatar.label} />
                <span className="font-mono text-[9px] leading-none"
                  style={{ color: selected ? avatar.color : 'rgba(255,255,255,0.45)' }}>
                  {avatar.label.toUpperCase()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Name */}
        <div className="w-full max-w-xs mb-6">
          <label htmlFor="entry-name" className="font-mono text-white/40 text-[10px] uppercase tracking-widest block mb-2">
            Your name
          </label>
          <div className="flex gap-2">
            <input
              id="entry-name"
              type="text"
              maxLength={24}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 min-w-0 bg-white/[0.06] border border-white/10 text-white font-mono px-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#7B2FBE] focus:border-[#7B2FBE] placeholder:text-white/20 backdrop-blur"
              placeholder="Your name or handle..."
            />
            <button
              type="button"
              onClick={() => setName(randomUniqueName())}
              aria-label="Shuffle a new name suggestion"
              title="Shuffle a new suggestion"
              className="shrink-0 w-12 flex items-center justify-center bg-white/[0.06] border border-white/10 text-white/40 rounded-xl hover:text-white hover:border-[#7B2FBE] transition-colors min-h-[44px]"
            >
              <Shuffle className="w-4 h-4" aria-hidden="true" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <TurnstileWidget onToken={setCaptchaToken} />

        <button
          type="button"
          disabled={!canSubmit || loading}
          onClick={handleTuneIn}
          className="w-full max-w-xs py-4 font-display font-bold tracking-[0.25em] text-sm rounded-xl transition-all bg-[#7B2FBE] text-white hover:bg-[#9B4FDE] disabled:opacity-40 disabled:cursor-not-allowed min-h-[52px]"
          style={canSubmit ? { boxShadow: '0 0 28px rgba(123,47,190,0.55)' } : undefined}
        >
          {loading ? 'TUNING IN...' : 'TUNE IN'}
        </button>

        {error && (
          <p role="alert" className="mt-4 font-mono text-[#ff6b6b] text-sm text-center max-w-xs">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
