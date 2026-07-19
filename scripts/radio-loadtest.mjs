#!/usr/bin/env node
// Radio capacity load test: fake N listeners tuning in at once, measure how many get in.
//
// Simulates the real listener join: anonymous Supabase sign-in (the rate-limited step) →
// POST /api/rtc-session {phase:'subscribe-pull'} with the fresh token (the Cloudflare pull).
// Reports how many succeeded vs were rate-limited, so you can prove the raised Supabase cap
// holds BEFORE a real broadcast.
//
// Usage:
//   node scripts/radio-loadtest.mjs <site-url> [count]
//   e.g. node scripts/radio-loadtest.mjs https://<preview>.vercel.app 120
//
// Requires two env vars (they're in your local .env — the anon key is public by design):
//   SUPABASE_URL           (or VITE_SUPABASE_URL)
//   SUPABASE_ANON_KEY      (or VITE_SUPABASE_PUBLISHABLE_KEY)
//
// PREREQUISITES:
//   1. Raise the Supabase anonymous sign-in rate limit first (that's what you're testing).
//   2. The project has Turnstile captcha on sign-in. A script can't solve a captcha, so
//      TEMPORARILY disable captcha (Supabase → Authentication → Attack Protection) for the
//      test window, then re-enable it. If you see "captcha" errors below, that's why.
//   3. Point at a PREVIEW url, not production — this creates throwaway anon users.

import { createClient } from '@supabase/supabase-js';

const siteUrl = process.argv[2];
const count = Number(process.argv[3] ?? 120);
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!siteUrl || !supabaseUrl || !anonKey) {
  console.error('Missing input.\n' +
    '  arg1  site url (preview)         -> ' + (siteUrl ?? 'MISSING') + '\n' +
    '  SUPABASE_URL / VITE_SUPABASE_URL -> ' + (supabaseUrl ? 'set' : 'MISSING') + '\n' +
    '  SUPABASE_ANON_KEY / VITE_...     -> ' + (anonKey ? 'set' : 'MISSING'));
  process.exit(1);
}

const rtcEndpoint = siteUrl.replace(/\/+$/, '') + '/api/rtc-session';

const tally = {
  signInOk: 0, signInRateLimited: 0, signInCaptcha: 0, signInOther: 0,
  pullOk: 0, pullRateLimited: 0, pull503Offline: 0, pull502Cf: 0, pullOther: 0,
};
const samples = [];

async function oneListener(i) {
  // Fresh client per listener = fresh session, mirroring a real browser.
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data?.session) {
    const msg = (error?.message ?? 'no session').toLowerCase();
    if (msg.includes('rate limit')) tally.signInRateLimited++;
    else if (msg.includes('captcha')) tally.signInCaptcha++;
    else { tally.signInOther++; if (samples.length < 5) samples.push(`signin[${i}]: ${error?.message}`); }
    return;
  }
  tally.signInOk++;
  const token = data.session.access_token;
  try {
    const res = await fetch(rtcEndpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: 'subscribe-pull' }),
    });
    if (res.ok) { tally.pullOk++; return; }
    const bodyText = await res.text().catch(() => '');
    if (res.status === 429) tally.pullRateLimited++;
    else if (res.status === 503) tally.pull503Offline++;
    else if (res.status === 502) tally.pull502Cf++;
    else { tally.pullOther++; if (samples.length < 5) samples.push(`pull[${i}]: ${res.status} ${bodyText.slice(0, 120)}`); }
  } catch (err) {
    tally.pullOther++;
    if (samples.length < 5) samples.push(`pull[${i}] threw: ${err.message}`);
  }
}

console.log(`Firing ${count} simultaneous listeners at ${rtcEndpoint}\n(station must be LIVE for subscribe-pull to succeed)\n`);
const started = Date.now();
await Promise.allSettled(Array.from({ length: count }, (_, i) => oneListener(i)));
const secs = ((Date.now() - started) / 1000).toFixed(1);

console.log(`Done in ${secs}s.\n`);
console.log('SIGN-IN (the Supabase rate-limited step):');
console.log(`  ok            ${tally.signInOk}`);
console.log(`  rate-limited  ${tally.signInRateLimited}   <- raise Supabase anon sign-in limit if > 0`);
console.log(`  captcha       ${tally.signInCaptcha}   <- disable captcha for the test if > 0`);
console.log(`  other fail    ${tally.signInOther}`);
console.log('\nSUBSCRIBE-PULL (Cloudflare relay, needs station LIVE):');
console.log(`  ok            ${tally.pullOk}`);
console.log(`  rate-limited  ${tally.pullRateLimited}`);
console.log(`  offline(503)  ${tally.pull503Offline}   <- station not live`);
console.log(`  cf-error(502) ${tally.pull502Cf}`);
console.log(`  other         ${tally.pullOther}`);
if (samples.length) console.log('\nsamples:\n  ' + samples.join('\n  '));

const admitted = tally.signInOk;
console.log(`\n==> ${admitted}/${count} listeners got past login. Target: all ${count}.`);
process.exit(admitted === count ? 0 : 1);
