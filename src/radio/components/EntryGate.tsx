import { useState, useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AVATARS, randomDefaultName } from '../avatars';
import { createIdentity, saveIdentity } from '../identity';
import type { Identity } from '../types';
import { TurnstileWidget } from './TurnstileWidget';

interface EntryGateProps {
  supabase: SupabaseClient;
  onEntry: (identity: Identity, uid: string) => void;
}

export function EntryGate({ supabase, onEntry }: EntryGateProps) {
  const [selectedAvatarId, setSelectedAvatarId] = useState('');
  const [name, setName] = useState(() => randomDefaultName());
  const [captchaToken, setCaptchaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Captcha is best-effort: it produces a token only where the domain is allow-listed
  // (production). On preview/unlisted domains it can't run, so don't block entry on it —
  // the token is still passed when present, and the server enforces captcha when required.
  const canSubmit = name.trim().length >= 1 && selectedAvatarId !== '';

  const handleTuneIn = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: authError } = await supabase.auth.signInAnonymously({
        options: captchaToken ? { captchaToken } : {},
      });
      if (authError || !data.user) {
        setError(authError?.message ?? 'Sign-in failed. Try again.');
        return;
      }
      const identity = createIdentity(name.trim(), selectedAvatarId);
      saveIdentity(identity);
      onEntry(identity, data.user.id);
    } catch {
      setError('Connection error. Check your network and try again.');
    } finally {
      setLoading(false);
    }
  }, [canSubmit, supabase, captchaToken, name, selectedAvatarId, onEntry]);

  return (
    <div className="min-h-screen bg-[#0a0010] flex flex-col items-center justify-center p-6">
      <h1 className="font-mono text-white text-2xl font-bold tracking-widest mb-1">
        SUBSPACE RADIO LIVE
      </h1>
      <p className="font-mono text-[#888] text-sm mb-8 tracking-wide">Choose your identity</p>

      <div className="grid grid-cols-4 gap-3 mb-8" role="radiogroup" aria-label="Avatar">
        {AVATARS.map((avatar) => {
          const selected = selectedAvatarId === avatar.id;
          return (
            <button
              key={avatar.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={avatar.label}
              className={`flex flex-col items-center gap-1 p-2 min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                selected ? 'bg-white/10 ring-2 ring-white' : 'hover:bg-white/5'
              }`}
              onClick={() => setSelectedAvatarId(avatar.id)}
            >
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: avatar.color, color: avatar.textColor }}
              >
                {avatar.label.slice(0, 2).toUpperCase()}
              </span>
              <span className="font-mono text-[10px] text-[#aaa] leading-none">{avatar.label}</span>
            </button>
          );
        })}
      </div>

      <div className="w-full max-w-xs mb-6">
        <label htmlFor="entry-name" className="font-mono text-[#888] text-xs uppercase tracking-widest block mb-2">
          Your name
        </label>
        <input
          id="entry-name"
          type="text"
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#1a0030] border border-[#333] text-white font-mono px-4 py-3 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#7B2FBE] placeholder:text-[#555]"
          placeholder="Your name"
        />
      </div>

      <TurnstileWidget onToken={setCaptchaToken} />

      <button
        type="button"
        disabled={!canSubmit || loading}
        onClick={handleTuneIn}
        className="w-full max-w-xs py-4 font-mono font-bold tracking-widest text-sm rounded-lg transition-colors bg-[#7B2FBE] text-white hover:bg-[#9B4FDE] disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
      >
        {loading ? 'TUNING IN...' : 'TUNE IN'}
      </button>

      {error && (
        <p role="alert" className="mt-4 font-mono text-[#ff6b6b] text-sm text-center max-w-xs">
          {error}
        </p>
      )}
    </div>
  );
}
