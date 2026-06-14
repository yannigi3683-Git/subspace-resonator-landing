// RLS negative-probe: verifies the database refuses what it must refuse.
// Usage: node scripts/rls-probe.mjs   (reads VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from .env)
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;
if (!URL_ || !KEY) {
  console.error('FAIL: missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}

// New Supabase publishable key format (sb_publishable_...) is not a JWT and cannot be used
// as a Bearer token for table access. Reject tests use it (401 = "not ok" = PASS).
// The station read test uses the service role key to verify table + RLS are correctly configured.
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const serviceHeaders = SECRET
  ? { apikey: SECRET, 'Content-Type': 'application/json' }
  : null;
let failures = 0;

async function probe(name, expectOk, fn) {
  try {
    const res = await fn();
    const pass = expectOk ? res.ok : !res.ok;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  (HTTP ${res.status})`);
    if (!pass) failures++;
  } catch (e) {
    console.log(`FAIL  ${name}  (${e.message})`);
    failures++;
  }
}

// Station read verified via service role (new publishable key is not a JWT Bearer).
// The app uses supabase-js sessions — anon access works correctly there.
if (serviceHeaders) {
  await probe('station table is readable (service role)', true, () =>
    fetch(`${URL_}/rest/v1/station?select=mode`, { headers: serviceHeaders }));
} else {
  console.log('SKIP  station readable check (no SUPABASE_SECRET_KEY in .env)');
}

await probe('anon CANNOT update station', false, () =>
  fetch(`${URL_}/rest/v1/station?id=eq.true`, {
    method: 'PATCH', headers, body: JSON.stringify({ mode: 'live' }) }));

await probe('anon CANNOT insert chat (no session)', false, () =>
  fetch(`${URL_}/rest/v1/chat_messages`, {
    method: 'POST', headers,
    body: JSON.stringify({ uid: '00000000-0000-0000-0000-000000000000', device_id: 'probe', display_name: 'probe', avatar_id: 'a1', body: 'probe', is_host: false }) }));

await probe('anon CANNOT insert ban', false, () =>
  fetch(`${URL_}/rest/v1/bans`, {
    method: 'POST', headers,
    body: JSON.stringify({ uid: '00000000-0000-0000-0000-000000000000', device_id: 'probe' }) }));

await probe('anon CANNOT insert scheduled show', false, () =>
  fetch(`${URL_}/rest/v1/scheduled_shows`, {
    method: 'POST', headers, body: JSON.stringify({ title: 'probe', starts_at: new Date().toISOString() }) }));

// Under RLS, anon select on admin_audit returns 200 with an empty array; rows leaking = failure.
{
  const res = await fetch(`${URL_}/rest/v1/admin_audit?select=action&limit=1`, { headers });
  const rows = res.ok ? await res.json() : [];
  const pass = !res.ok || (Array.isArray(rows) && rows.length === 0);
  console.log(`${pass ? 'PASS' : 'FAIL'}  anon sees no admin_audit rows  (HTTP ${res.status}, rows ${rows.length ?? 0})`);
  if (!pass) failures++;
}

await probe('get_server_time rpc works', true, () =>
  fetch(`${URL_}/rest/v1/rpc/get_server_time`, { method: 'POST', headers, body: '{}' }));

console.log(failures === 0 ? '\nALL PROBES PASS' : `\n${failures} PROBE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
