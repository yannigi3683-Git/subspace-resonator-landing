#!/usr/bin/env node
// Read the radio room's presence roster straight from the server, without joining it.
//
// This is the referee for "the host console says N but the room says M". It subscribes to
// 'room:main' and NEVER calls track(), so it holds no presence meta, emits no presence_diff, and
// is invisible to every other client — no avatar on the dance floor, nothing in the roster, no
// chat. Safe to run DURING a live broadcast, which is the only time the question can be answered.
//
// Its number is server truth: a brand-new socket gets a fresh presence_state, which is the same
// snapshot any newly-arriving listener would see. Compare it against the host console badge and
// the guest room's "N listeners online" AT THE SAME INSTANT — a room that churns makes two
// glances a minute apart disagree honestly, and that is not a bug.
//
// Usage:
//   node --env-file=.env scripts/radio-presence-probe.mjs [seconds] [intervalSeconds]
//                                                         (default 120, 10)
//
// Env (the anon key is public by design):
//   SUPABASE_URL       (or VITE_SUPABASE_URL)
//   SUPABASE_ANON_KEY  (or VITE_SUPABASE_PUBLISHABLE_KEY)
//
// READ BEFORE RUNNING:
//   1. Costs ONE anonymous sign-in against the 300/h PER-IP cap, and leaves one throwaway user
//      behind (Supabase → Authentication → Users). One per run, not one per sample.
//   2. Unlike radio-fake-crowd.mjs it puts NOBODY in the room, so it is safe on a live show.
//   3. The station does not need to be live. Presence is independent of the audio path.

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const totalSeconds = Number(args[0] ?? 120);
const intervalSeconds = Number(args[1] ?? 10);
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!Number.isFinite(totalSeconds) || totalSeconds < 1 || !Number.isFinite(intervalSeconds) || intervalSeconds < 1 || !supabaseUrl || !anonKey) {
  console.error('Missing or bad input.\n' +
    '  arg1  seconds to run (default 120)   -> ' + (args[0] ?? '120') + '\n' +
    '  arg2  sample interval s (default 10) -> ' + (args[1] ?? '10') + '\n' +
    '  SUPABASE_URL / VITE_SUPABASE_URL     -> ' + (supabaseUrl ? 'set' : 'MISSING') + '\n' +
    '  SUPABASE_ANON_KEY / VITE_...         -> ' + (anonKey ? 'set' : 'MISSING'));
  process.exit(1);
}

// Mirrors dedupeByDevice in src/radio/hooks/usePresence.ts, which BOTH UIs apply. Presence is
// keyed per connection and anon re-auth mints a new uid, so one browser can hold two refs.
function dedupeByDevice(rows) {
  const byDevice = new Map();
  for (const p of rows) byDevice.set(p.deviceId || p.uid, p);
  return byDevice;
}

const supabase = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
const { data, error } = await supabase.auth.signInAnonymously();
if (error) {
  console.error('anon sign-in failed:', error.message);
  console.error('A 429 here means the 300/h per-IP cap is spent, not that the room is broken.');
  process.exit(1);
}
await supabase.realtime.setAuth(data.session.access_token);

const channel = supabase.channel('room:main', { config: { private: true } });

// These handlers are REQUIRED even though they do nothing. supabase-js only enables presence on a
// channel that has presence bindings; without them presenceState() silently returns {} forever and
// the probe reports an empty room no matter who is in it. Do not "clean up" these three lines.
channel
  .on('presence', { event: 'sync' }, () => {})
  .on('presence', { event: 'join' }, () => {})
  .on('presence', { event: 'leave' }, () => {});

let subscribed = false;
let closing = false;
channel.subscribe((status, err) => {
  if (status === 'SUBSCRIBED') subscribed = true;
  else if (!closing) console.error('channel status:', status, err?.message ?? '');
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(4000);
if (!subscribed) {
  console.error('never reached SUBSCRIBED — check the anon key and that room:main still allows anon reads.');
  process.exit(1);
}

console.log('observing room:main (never tracking, invisible to the room)');
console.log('compare "deduped" against the host console badge and the guest room, at the SAME instant.\n');

const samples = Math.max(1, Math.round(totalSeconds / intervalSeconds));
for (let i = 0; i < samples; i++) {
  const rows = Object.values(channel.presenceState()).flat();
  const byDevice = dedupeByDevice(rows);
  console.log(
    new Date().toLocaleTimeString(),
    'metas', String(rows.length).padStart(3),
    ' deduped', String(byDevice.size).padStart(3),
    ' ', [...byDevice.values()].map((p) => p.name).join(', ') || '(empty)',
  );
  if (i === 0) {
    const seen = new Map();
    for (const p of rows) {
      const k = p.deviceId || p.uid;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    for (const [k, n] of seen) {
      if (n > 1) console.log('   same-device duplicate', String(k).slice(0, 10), 'x' + n, '(collapsed above)');
    }
  }
  if (i < samples - 1) await sleep(intervalSeconds * 1000);
}

closing = true; // removeChannel reports CLOSED through the same callback; that is not a fault
await supabase.removeChannel(channel);
process.exit(0);
