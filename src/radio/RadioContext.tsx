import { createContext, useContext } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Identity, Station } from './types';

export interface RadioContextValue {
  supabase: SupabaseClient;
  identity: Identity;
  uid: string;
  station: Station | null;
  getServerTime: () => Date;
}

export const RadioContext = createContext<RadioContextValue | null>(null);

export function useRadio(): RadioContextValue {
  const ctx = useContext(RadioContext);
  if (!ctx) throw new Error('useRadio must be used inside RadioContext.Provider');
  return ctx;
}
