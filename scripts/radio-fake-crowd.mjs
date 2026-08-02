#!/usr/bin/env node
// Fill the radio room with N fake listeners so host-side UI can be tested with a real crowd.
//
// The sibling script radio-loadtest.mjs measures the Supabase sign-in ceiling: it signs in and
// POSTs subscribe-pull, but never joins the presence channel, so it puts nobody in the roster.
// This one does the opposite — it does exactly what usePresence.ts does (anonymous sign-in →
// subscribe to the private 'room:main' channel → track()) and nothing else. No audio is pulled.
//
// Usage (--env-file lets Node read .env itself, so there is no env-var juggling):
//   node --env-file=.env scripts/radio-fake-crowd.mjs [count] [nameOffset] [--chat]
//                                                     (default 20, 0, presence only)
// Runs until Ctrl+C, which untracks everyone so the room empties immediately.
//
// To grow a crowd you already have, start a SECOND window with an offset rather than
// restarting: `... 60 60` adds Test 61-120 beside a running `... 60`. Restarting would
// re-spend sign-ins you already paid for against the per-IP cap below.
//
// --chat makes the fakes talk, so the chat panel has something in it to be judged against.
// These are REAL rows in chat_messages, subject to the same RLS as any listener:
//   * they only land while the station is LIVE, unlocked, and past slow mode. Off air every
//     insert is refused by chat_allowed() and the script says so.
//   * they sit in the table for the usual 48h TTL, and they WILL appear in the transcript
//     that END BROADCAST downloads. Do not use --chat on a broadcast whose log you care about.
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

const args = process.argv.slice(2);
const withChat = args.includes('--chat');
const positional = args.filter((a) => !a.startsWith('--'));
const count = Number(positional[0] ?? 20);
// Shifts the Test NN labels so a second window's crowd does not duplicate the first's names.
const nameOffset = Number(positional[1] ?? 0);
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!Number.isFinite(count) || count < 1 || !Number.isFinite(nameOffset) || nameOffset < 0 || !supabaseUrl || !anonKey) {
  console.error('Missing or bad input.\n' +
    '  arg1  count (default 20)         -> ' + (positional[0] ?? '20') + '\n' +
    '  arg2  name offset (default 0)    -> ' + (positional[1] ?? '0') + '\n' +
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
  const n = i + 1 + nameOffset;
  const label = `Test ${String(n).padStart(2, '0')}`;
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
  const fake = {
    supabase,
    channel,
    uid: data.session.user.id,
    name: label,
    avatarId: AVATAR_IDS[n % AVATAR_IDS.length],
    // A distinct deviceId per fake, or dedupeByDevice() in usePresence collapses them
    // all into one entry and the roster stays one row tall.
    deviceId: crypto.randomUUID(),
  };
  clients.push(fake);

  await new Promise((resolve) => {
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          uid: fake.uid,
          name: fake.name,
          avatarId: fake.avatarId,
          deviceId: fake.deviceId,
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

// --- optional chatter -------------------------------------------------------------------

const LINES = [
  'test message', 'checking in', 'sound is good here', 'hello from the test crowd',
  'nice set', 'buffering fine', 'loud and clear', 'testing 1 2 3',
  'still here', 'this track is good', 'greetings', 'audio ok on mobile',
];

let sent = 0;
let chatErrors = 0;

async function say(fake) {
  const { error } = await fake.supabase.from('chat_messages').insert({
    uid: fake.uid,
    device_id: fake.deviceId,
    display_name: fake.name,
    avatar_id: fake.avatarId,
    body: LINES[Math.floor(Math.random() * LINES.length)],
    is_host: false,
    reply_to_id: null,
    reply_to_name: null,
    reply_to_body: null,
  });
  if (!error) { sent++; return; }
  chatErrors++;
  // 23514 is the chat_allowed() check constraint, which is the expected refusal off air.
  if (chatErrors <= 2) {
    console.error('  chat refused: ' + (error.code === '23514'
      ? 'chat_allowed() said no — station not live, chat locked, slow mode, or banned'
      : error.message));
  }
}

if (withChat && clients.length) {
  console.log('\n--chat: fakes will talk. Real rows in chat_messages, 48h TTL, and they will');
  console.log('appear in the END BROADCAST transcript. Needs the station LIVE and unlocked.');
  // Staggered opening burst, then an occasional line, so the panel fills the way a real room
  // does rather than as one wall of text.
  for (const fake of clients) setTimeout(() => say(fake), 500 + Math.random() * 15000);
  setInterval(() => say(clients[Math.floor(Math.random() * clients.length)]), 20000);
}

let leaving = false;
process.on('SIGINT', async () => {
  if (leaving) process.exit(1);
  leaving = true;
  console.log('\nLeaving …');
  await Promise.allSettled(clients.map(async ({ supabase, channel }) => {
    await channel.untrack().catch(() => {});
    await supabase.removeChannel(channel);
  }));
  console.log(`Room emptied${withChat ? `, ${sent} messages sent` : ''}.` +
    ' Delete the throwaway users in Supabase → Authentication → Users.');
  process.exit(0);
});
