import { createClient } from '@supabase/supabase-js';

// Strip everything outside printable ASCII. Pasting keys/URLs into a dashboard often
// drags along an invisible character (zero-width space, BOM, smart quote) above code
// point 255. Real Supabase keys/URLs are pure ASCII, so removing such chars recovers
// the intended value. A stray char in the apikey/Authorization header makes the browser
// reject the request with "String contains non ISO-8859-1 code point" at the fetch layer.
function toAscii(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 0x20 && code <= 0x7e) out += s[i];
  }
  return out.trim();
}

// Drop characters above ISO-8859-1 (code point 255) from header names/values, which the
// browser's fetch refuses to send. Defensive backstop for any header supabase-js builds.
function sanitizeHeaderValue(v: string): string {
  let out = '';
  for (let i = 0; i < v.length; i++) {
    if (v.charCodeAt(i) <= 0xff) out += v[i];
  }
  return out;
}

export function makeSupabase(auth?: { persistSession?: boolean; autoRefreshToken?: boolean; storageKey?: string }) {
  const url = toAscii(import.meta.env.VITE_SUPABASE_URL as string);
  const key = toAscii(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
  if (!url || !key) return null;

  // supabase-js captures window.fetch at createClient() time, so module-level patches
  // applied later are too late. Pass a custom fetch here so supabase uses our sanitizing
  // wrapper from the start, for every auth/REST/realtime call.
  const cleanFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!init?.headers) return fetch(input, init);
    let h: Record<string, string>;
    if (init.headers instanceof Headers) {
      h = {};
      (init.headers as Headers).forEach((value, name) => { h[name] = value; });
    } else if (Array.isArray(init.headers)) {
      h = {};
      (init.headers as [string, string][]).forEach(([name, value]) => { h[name] = value; });
    } else {
      h = { ...(init.headers as Record<string, string>) };
    }
    const clean: Record<string, string> = {};
    for (const [name, value] of Object.entries(h)) {
      clean[sanitizeHeaderValue(name)] = sanitizeHeaderValue(value);
    }
    return fetch(input, { ...init, headers: clean });
  };

  return createClient(url, key, { global: { fetch: cleanFetch }, ...(auth ? { auth } : {}) });
}
