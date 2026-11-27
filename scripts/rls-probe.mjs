// RLS negative-probe: verifies the database refuses what it must refuse, and can prove it.
//
// Usage (from the project folder, OFF AIR, with .env holding VITE_SUPABASE_URL,
// VITE_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY):
//   node scripts/rls-probe.mjs              real run: every line must say PASS
//   node scripts/rls-probe.mjs --selftest   same writes as the service role, which bypasses RLS:
//                                           every check must FAIL, proving the probe can see a hole
//
// Rebuilt 2026-11-25. The old probe sent the publishable key as a Bearer token, which Supabase
// always rejects with 401, and counted any non-OK response as PASS, so it could never fail.
// Now each attempt runs through supabase-js as a real attacker (no session, and an anonymous
// listener session, which is what every listener holds), and the result is confirmed with the
// service role. A write that got through is undone on the spot. Costs one anonymous sign-in.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { PROBE_TAG, PAST_ISO, insertRefused, updateRefused, deleteRefused, selectHidden, rpcAnswers, rpcRefused, summarize } from './rlsProbeChecks.mjs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SECRET = env.SUPABASE_SECRET_KEY;
const selftest = process.argv.includes('--selftest');

if (!URL_ || !KEY) {
  console.error('FAIL: missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY in .env');
  process.exit(1);
}
if (!SECRET) {
  console.error('INCOMPLETE: SUPABASE_SECRET_KEY is not in .env. Every check confirms its result with it, so nothing can be tested without it.');
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const wrap = (client) => ({
  insert: (t, row) => client.from(t).insert(row),
  update: (t, match, patch) => client.from(t).update(patch).match(match).select(),
  remove: (t, match) => client.from(t).delete().match(match).select(),
  select: (t, match, limit = 1000) => client.from(t).select('*').match(match).limit(limit),
  rpc: (fn, args) => client.rpc(fn, args),
});
const adminClient = createClient(URL_, SECRET, opts);
const admin = wrap(adminClient);

// Writes below create and remove fixture rows. During a broadcast a stray chat or ban row would
// reach real listeners, so the probe refuses to run while the station is live.
const { data: st, error: stErr } = await adminClient.from('station').select('mode').single();
if (stErr) {
  console.error(`FAIL: could not read the station row with the service key (${stErr.message})`);
  process.exit(1);
}
if (st.mode === 'live') {
  console.error('REFUSED: the station is LIVE. Run the probe off air.');
  process.exit(2);
}

const attackers = [];
let listenerId = null;
if (selftest) {
  attackers.push(['service role (selftest)', admin]);
} else {
  attackers.push(['no session', wrap(createClient(URL_, KEY, opts))]);
  const listenerClient = createClient(URL_, KEY, opts);
  const { data, error } = await listenerClient.auth.signInAnonymously();
  if (error || !data.user) {
    console.log(`SKIP  anonymous listener checks (sign-in failed: ${error?.message ?? 'no user'})`);
  } else {
    listenerId = data.user.id;
    attackers.push(['anon listener', wrap(listenerClient)]);
  }
}

const results = [];
const record = (who, name, r) => {
  results.push(r);
  const tag = r.pass === null ? 'SKIP' : r.pass ? 'PASS' : 'FAIL';
  console.log(`${tag}  [${who}] ${name}  (${r.detail})`);
};

const fixtureId = randomUUID();
const fixture = { id: fixtureId, title: `${PROBE_TAG} fixture, safe to delete`, starts_at: PAST_ISO };

try {
  // Dated in 2000, so it never reaches a standby screen even if a cleanup step fails.
  const { error: fxErr } = await admin.insert('scheduled_shows', fixture);
  if (fxErr) console.log(`SKIP  scheduled_shows fixture could not be created (${fxErr.message})`);

  for (const [who, attacker] of attackers) {
    const tagged = `${PROBE_TAG}-${randomUUID().slice(0, 8)}`;
    const ghost = randomUUID();

    record(who, 'cannot change the station row',
      await updateRefused({ attacker, admin, table: 'station', match: { id: true }, patch: { live_title: tagged } }));

    record(who, 'cannot add a scheduled show',
      await insertRefused({ attacker, admin, table: 'scheduled_shows',
        row: { title: tagged, starts_at: PAST_ISO }, match: { title: tagged } }));
    if (!fxErr) {
      record(who, 'cannot edit a scheduled show',
        await updateRefused({ attacker, admin, table: 'scheduled_shows', match: { id: fixtureId }, patch: { title: tagged } }));
      record(who, 'cannot delete a scheduled show',
        await deleteRefused({ attacker, admin, table: 'scheduled_shows', match: { id: fixtureId }, restoreRow: fixture }));
    }

    record(who, 'cannot ban anyone',
      await insertRefused({ attacker, admin, table: 'bans', row: { uid: ghost, device_id: tagged }, match: { uid: ghost } }));
    record(who, 'cannot kick anyone',
      await insertRefused({ attacker, admin, table: 'kicks', row: { uid: ghost, device_id: tagged }, match: { device_id: tagged } }));

    // Off air, chat_allowed() refuses every post, so this proves the off-air lock, not bans or
    // slow mode. Those need a live station and a real banned device (see CLAUDE.md, RLS section).
    record(who, 'cannot post chat while off air',
      await insertRefused({ attacker, admin, table: 'chat_messages',
        row: { uid: listenerId ?? ghost, device_id: tagged, display_name: 'probe', avatar_id: 'a1', body: tagged, is_host: false },
        match: { device_id: tagged } }));

    record(who, 'cannot read the admin audit log',
      await selectHidden({ attacker, admin, table: 'admin_audit' }));

    // SCHEDULE RUNNER: the lease decides which console may start shows by itself, and the
    // watchdog can take the station off air, so neither may be reachable by a visitor.
    const runner = { table: 'runner_status', match: { id: true } };
    record(who, 'cannot read the SCHEDULE RUNNER status',
      await selectHidden({ attacker, admin, table: 'runner_status' }));
    record(who, 'cannot change the SCHEDULE RUNNER status',
      await updateRefused({ attacker, admin, ...runner, patch: { device_label: tagged.slice(0, 40) } }));
    record(who, 'cannot arm SCHEDULE RUNNER',
      await rpcRefused({ attacker, admin, ...runner, fn: 'runner_claim', args: { _lease_id: ghost, _label: tagged.slice(0, 40) } }));
    record(who, 'cannot send a SCHEDULE RUNNER heartbeat',
      await rpcRefused({ attacker, admin, ...runner, fn: 'runner_beat',
        args: { _lease_id: ghost, _state: 'armed', _next: null, _broadcast: null, _message: tagged } }));
    record(who, 'cannot disarm SCHEDULE RUNNER',
      await rpcRefused({ attacker, admin, ...runner, fn: 'runner_release', args: { _lease_id: ghost } }));
    record(who, 'cannot run the SCHEDULE RUNNER watchdog',
      await rpcRefused({ attacker, admin, table: 'station', match: { id: true }, fn: 'runner_watchdog', args: {} }));
  }

  if (!selftest) {
    record('no session', 'can read the server clock',
      rpcAnswers(await createClient(URL_, KEY, opts).rpc('get_server_time')));
    // The off-air countdown reads through this before any sign-in, so a missing execute grant
    // would leave every guest on a blank standby screen. grants.test.ts cannot see .rpc() grants.
    for (const [who, attacker] of attackers) {
      record(who, 'can read the upcoming schedule',
        rpcAnswers(await attacker.rpc('upcoming_shows', { _limit: 3 }), { list: true }));
    }
  }
} finally {
  await admin.remove('scheduled_shows', { id: fixtureId });
  if (listenerId) await adminClient.auth.admin.deleteUser(listenerId).catch(() => {});
}

const { ok, line } = summarize(results, { selftest });
console.log(`\n${line}`);
process.exit(ok ? 0 : 1);
