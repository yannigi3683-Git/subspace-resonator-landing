// Restreamer main. Watches the station row; when the DJ goes live, pulls the SFU audio, transcodes
// to HLS, publishes it (local sink or R2), and writes live_session.streamUrl so listeners flip to
// the deep-buffer stream. When the show ends (or the broadcast id changes), tears everything down
// and clears streamUrl so listeners fall back to WebRTC. One broadcast at a time.
import { createClient } from '@supabase/supabase-js';
import { mkdtempSync } from 'node:fs';
import { writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from './config.mjs';
import { makeStationClient, watchStation, decideAction, setStreamUrl, fetchStation, hasStaleStreamUrl } from './station.mjs';
import { negotiatePull } from './cfPull.mjs';
import { startHls, rtpInputArgs } from './hls.mjs';
import { makeCleanup } from './cleanup.mjs';
import { serveLocal } from './sink/local.mjs';
import { startR2Sink } from './sink/r2.mjs';

const RTP_PORT = 5004; // single broadcast, fixed local port
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cfg = loadConfig();
if (!cfg.supabaseUrl || !cfg.supabaseSecretKey || !cfg.brokerUrl || !cfg.supabasePublishableKey) {
  console.error('Missing required env. See .env.example. Need SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY, BROKER_URL.');
  process.exit(1);
}
const supabase = makeStationClient(cfg);

async function anonToken() {
  const c = createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInAnonymously();
  if (error) throw new Error(`anon sign-in: ${error.message}`);
  return data.session.access_token;
}

async function waitForSegments(dir, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const files = await readdir(dir).catch(() => []);
    if (files.some((f) => f.endsWith('.ts'))) return true;
    await sleep(500);
  }
  throw new Error('no HLS segments produced within timeout');
}

let running = null; // { cfSessionId, stop() }
let busy = false;

async function startFor(cfSessionId) {
  log('GO LIVE', cfSessionId, '-> starting restream');
  const outDir = mkdtempSync(join(tmpdir(), 'restreamer-'));
  const token = await anonToken();
  const pull = await negotiatePull({ brokerUrl: cfg.brokerUrl, token, rtpPort: RTP_PORT, log });

  const sdp = [
    'v=0', 'o=- 0 0 IN IP4 127.0.0.1', 's=restreamer', 'c=IN IP4 127.0.0.1', 't=0 0',
    `m=audio ${RTP_PORT} RTP/AVP ${pull.opusPt}`, `a=rtpmap:${pull.opusPt} opus/48000/2`,
  ].join('\n') + '\n';
  await writeFile(join(outDir, 'input.sdp'), sdp);

  const ff = startHls({
    ffmpegPath: cfg.ffmpegPath,
    inputArgs: rtpInputArgs('input.sdp'),
    outDir,
    segmentSeconds: cfg.segmentSeconds,
    window: cfg.hlsWindow,
    aacBitrate: cfg.aacBitrate,
  });

  await pull.commit(); // media starts now that ffmpeg is listening

  let sink;
  if (cfg.sink === 'r2') {
    sink = await startR2Sink({ outDir, r2: cfg.r2, publicBaseUrl: cfg.publicBaseUrl, prefix: cfSessionId, log });
  } else {
    const server = await serveLocal({ dir: outDir, port: cfg.localPort });
    const base = cfg.publicBaseUrl || `http://127.0.0.1:${cfg.localPort}`;
    sink = { publicUrl: `${base}/stream.m3u8`, stop() { server.close(); } };
  }

  const cleanupResources = makeCleanup({ ff, pull, sink, outDir });

  // If the stream never comes up, tear down THIS attempt's resources before bubbling the error —
  // otherwise ffmpeg keeps holding the RTP port and the next attempt fails to bind.
  try {
    await waitForSegments(outDir);
  } catch (e) {
    cleanupResources();
    throw e;
  }
  await setStreamUrl(supabase, sink.publicUrl);
  log('streamUrl published:', sink.publicUrl, '(rtp packets so far', pull.rtpCount() + ')');

  running = {
    cfSessionId,
    async stop() {
      await setStreamUrl(supabase, null).catch((e) => log('clear streamUrl', e.message));
      cleanupResources();
    },
  };

  ff.on('exit', (code) => {
    // ffmpeg died mid-show: drop streamUrl (listeners fall back to WebRTC) so the next poll restarts.
    if (running?.cfSessionId === cfSessionId) {
      log('ffmpeg exited', code, '- will restart on next poll');
      setStreamUrl(supabase, null).catch(() => {});
      cleanupResources();
      running = null;
    }
  });
}

async function teardown() {
  if (running) { log('END', running.cfSessionId); await running.stop(); running = null; }
}

// On boot, clear a streamUrl left over from a crashed/killed run (station is off but still points
// at a dead HLS stream) so listeners aren't chasing it before the next show starts.
try {
  const boot = await fetchStation(supabase);
  if (hasStaleStreamUrl(boot)) {
    await setStreamUrl(supabase, null);
    log('cleared stale streamUrl from a previous run');
  }
} catch (e) {
  log('startup stale-streamUrl check failed', e.message);
}

watchStation(supabase, async (station) => {
  if (busy) return;
  const { action, cfSessionId } = decideAction(running?.cfSessionId, station);
  if (action === 'none') return;
  busy = true;
  try {
    if (action === 'stop' || action === 'restart') await teardown();
    if (action === 'start' || action === 'restart') await startFor(cfSessionId);
  } catch (e) {
    log('action error', action, e.message);
    await teardown().catch(() => {});
  } finally {
    busy = false;
  }
}, { log });

log('restreamer watching station (sink:', cfg.sink + ')');
process.on('SIGINT', async () => { await teardown().catch(() => {}); process.exit(0); });
