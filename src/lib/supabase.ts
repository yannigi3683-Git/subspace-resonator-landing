import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

// Returns null when env vars are absent (Vitest, build without env) so the
// site never tries to hit the network in test or CI contexts.
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;
