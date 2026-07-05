// Watches the singleton `station` row and drives the restreamer. Pure decision logic
// (decideAction) is separated out and unit-tested; the I/O around it is thin.
import { createClient } from '@supabase/supabase-js';

// Given the session id we're currently restreaming (or null) and the latest station row, decide
// what to do. Pure + total so it can be tested without Supabase.
export function decideAction(runningSessionId, station) {
  const live = station?.mode === 'live' && station?.live_session?.cfSessionId;
  const wantId = live ? station.live_session.cfSessionId : null;
  if (wantId && wantId !== runningSessionId) {
    return { action: runningSessionId ? 'restart' : 'start', cfSessionId: wantId };
  }
  if (!wantId && runningSessionId) return { action: 'stop' };
  return { action: 'none' };
}

// True when a streamUrl is advertised but the station is NOT live for it (a stale pointer left by a
// crashed/killed restreamer). On boot we clear it so listeners aren't chasing a dead HLS stream.
export function hasStaleStreamUrl(station) {
  if (!station?.live_session?.streamUrl) return false;
  return !(station.mode === 'live' && station.live_session.cfSessionId);
}

export function makeStationClient({ supabaseUrl, supabaseSecretKey }) {
  return createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false } });
}

export async function fetchStation(supabase) {
  const { data, error } = await supabase.from('station').select('*').eq('id', true).single();
  if (error) throw new Error(`fetchStation: ${error.message}`);
  return data;
}

// ponytail: 3s poll, not Realtime. Go-live/end are rare events; a few seconds of lag is fine.
// Upgrade to a Realtime subscription only if that lag ever matters.
export function watchStation(supabase, onStation, { intervalMs = 3000, log = () => {} } = {}) {
  let stopped = false;
  (async function loop() {
    while (!stopped) {
      try {
        onStation(await fetchStation(supabase));
      } catch (e) {
        log('watch error', e.message);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  })();
  return () => { stopped = true; };
}

// Merge streamUrl into the live_session jsonb (null clears it) so listeners flip to / off HLS.
export async function setStreamUrl(supabase, streamUrl) {
  const station = await fetchStation(supabase);
  if (!station?.live_session) return;
  const live_session = { ...station.live_session };
  if (streamUrl) live_session.streamUrl = streamUrl;
  else delete live_session.streamUrl;
  const { error } = await supabase.from('station').update({ live_session }).eq('id', true);
  if (error) throw new Error(`setStreamUrl: ${error.message}`);
}
