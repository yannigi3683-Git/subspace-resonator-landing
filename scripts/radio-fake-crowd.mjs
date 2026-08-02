#!/usr/bin/env node
// Fill the radio room with N fake listeners so host-side UI can be tested with a real crowd.
//
// The sibling script radio-loadtest.mjs measures the Supabase sign-in ceiling: it signs in and
// POSTs subscribe-pull, but never joins the presence channel, so it puts nobody in the roster.
// This one does the opposite — it does exactly what usePresence.ts does (anonymous sign-in →
// subscribe to the private 'room:main' channel → track()) and nothing else. No audio is pulled.
//
// Usage:
//   node scripts/radio-fake-crowd.mjs [count]     (default 20)
// Runs until Ctrl+C, which untracks everyone so the room empties immediately.
//
// Env (same as radio-loadtest.mjs; the anon key is public by design):
//   SUPABASE_URL       (or VITE_SUPABASE_URL)
//   SUPABASE_ANON_KEY  (or VITE_SUPABASE_PUBLISHABLE_KEY)
//
// READ BEFORE RUNNING:
//   1. 'room:main' is ONE channel for the whole Supabase project — it is not scoped per
//      broadcast or per deployment. Fakes joined from here show up in the PRODUCTION room, to
//      any real listener who is in it. Only run this when the room is empty of real people.
//   2. Each fake burns one anonymous sign-in against the 300/h PER-IP cap and leaves a
//      throwaway user behind. Delete them afterwards: Supabase → Authentication → Users.
//   3. The station does not need to be live. Presence is independent of the audio path.

import { createClient } from '@supabase/supabase-js';

const count = Number(process.argv[2] ?? 20);
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!Number.isFinite(count) || count < 1 || !supabaseUrl || !anonKey) {
  console.error('Missing or bad input.\n' +
    '  arg1  count (default 20)         -> ' + (process.argv[2] ?? '20') + '\n' +
    '  SUPABASE_URL / VITE_SUPABASE_URL -> ' + (supabaseUrl ? 'set' : 'MISSING') + '\n' +
    '  SUPABASE_ANON_KEY / VITE_...     -> ' + (anonKey ? 'set' : 'MISSING'));
  process.exit(1);
}

// Mirrors src/radio/avatars.ts. Inlined because this is a .mjs script and cannot import the
// .ts module without a loader; only the ids matter, and an unknown id falls back to the first.
const AVATAR_IDS = [
  'nebula', 'vortex', 'fractal', 'pulsar', 'wormhole', 'quasar',
  'singularity', 'rift', 'cosmic', 'zenith', 'eclipse', 'resonance',
];

// Matches the ranges derivePosition() produces in src/radio/identity.ts, so DanceFloor places
// these inside the crowd band rather than over the stage.
const randomPosition = () => ({
  x: Math.round(5 + Math.random() * 85),
  y: Math.round(15 + Math.random() * 70),
});

const clients = [];
let joined = 0;
let failed = 0;

async function joinOne(i) {
  const label = `Test ${String(i + 1).padStart(2, '0')}`;
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data?.session) {
    failed++;
    if (failed <= 3) console.error(`  ${label}: sign-in failed — ${error?.message ?? 'no session'}`);
    return;
  }

  const channel = supabase.channel('room:main', { config: { private: true } });
  clients.push({ supabase, channel });

  await new Promise((resolve) => {
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          uid: data.session.user.id,
          name: label,
          avatarId: AVATAR_IDS[i % AVATAR_IDS.length],
          // A distinct deviceId per fake, or dedupeByDevice() in usePresence collapses them
          // all into one entry and the roster stays one row tall.
          deviceId: crypto.randomUUID(),
          position: randomPosition(),
        });
        joined++;
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        failed++;
        if (failed <= 3) console.error(`  ${label}: channel ${status}`);
        resolve();
      }
    });
  });
}

console.log(`Joining ${count} fake listeners to room:main …\n`);
await Promise.allSettled(Array.from({ length: count }, (_, i) => joinOne(i)));

console.log(`\n==> ${joined}/${count} in the room${failed ? ` (${failed} failed)` : ''}.`);
console.log('They stay until you press Ctrl+C. Reload /radio to see them.');

let leaving = false;
process.on('SIGINT', async () => {
  if (leaving) process.exit(1);
  leaving = true;
  console.log('\nLeaving …');
  await Promise.allSettled(clients.map(async ({ supabase, channel }) => {
    await channel.untrack().catch(() => {});
    await supabase.removeChannel(channel);
  }));
  console.log('Room emptied. Delete the throwaway users in Supabase → Authentication → Users.');
  process.exit(0);
});
