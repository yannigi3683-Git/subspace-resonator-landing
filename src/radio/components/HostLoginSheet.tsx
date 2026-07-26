import { X } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import AdminGate from '../admin/AdminGate';

interface Props {
  supabase: SupabaseClient;
  onClose: () => void;
}

/**
 * Elevates the current session to the host's admin (aal2) session without leaving the room.
 * Needed because the host is usually in the guest room on a second device, which has only an
 * anonymous listener session. Wraps AdminGate as-is rather than duplicating the password ->
 * TOTP flow, so there is exactly one host sign-in implementation to keep secure.
 */
export function HostLoginSheet({ supabase, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-[#0a0010] overflow-y-auto" role="dialog" aria-modal="true" aria-label="Host sign in">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close host sign in"
        className="absolute top-3 right-3 z-10 w-11 h-11 flex items-center justify-center text-white/50 hover:text-white transition-colors"
      >
        <X size={18} />
      </button>
      {/* onAuthenticated fires after the TOTP step; useModeration picks the elevated session up
          through onAuthStateChange, so there is nothing to pass back up. */}
      <AdminGate supabase={supabase} onAuthenticated={onClose} />
    </div>
  );
}
