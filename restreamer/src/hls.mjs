// ffmpeg HLS muxer. Reads audio (RTP from the SFU pull, or any ffmpeg input), writes a rolling
// audio-only HLS playlist with MPEG-TS segments. mpegts (not fMP4) is used deliberately: fMP4
// segmenting off a live RTP source produced a duplicated-MOOV / stretched-timeline bug (audio
// played ~3x slow); mpegts AAC is rock-solid, plays natively on iOS AND via hls.js, and was the
// format the original spike decoded clean. Deep buffer lives on the CLIENT (hls.js/native config).
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// A restart inside the same show reuses the R2 prefix (the host cfSessionId). Fresh, ffmpeg would
// rewrite stream0.ts.., and phones replay their immutable cached copies of those names (listeners
// jumped ~20 min back, 2026-11-12). Seeding the live playlist lets `append_list` continue the
// numbering and mark a discontinuity. Segments uploaded after the last playlist PUT may be
// overwritten, but no playlist ever referenced them, so no phone fetched them. Any failure starts
// fresh: a deep buffer that might replay beats one that never comes up.
export async function seedPlaylist({ url, outDir, fetchImpl = fetch, log = () => {} }) {
  try {
    const res = await fetchImpl(`${url}?cb=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const body = await res.text();
    const last = body.startsWith('#EXTM3U') && body.trim().split('\n').filter((l) => l.trim().endsWith('.ts')).at(-1);
    if (!last) return null;
    await writeFile(join(outDir, 'stream.m3u8'), body);
    log('resuming existing playlist after', last.trim());
    return last.trim();
  } catch (e) {
    log('seed playlist failed, numbering from 0 (a mid-show restart may replay old audio):', e.message);
    return null;
  }
}

// RTP-from-SDP input flags. cfPull re-stamps the RTP with clean monotonic sequence numbers and
// timestamps, so ffmpeg can use them directly (no genpts/wallclock hacks needed).
export function rtpInputArgs(sdpFile = 'input.sdp') {
  return ['-protocol_whitelist', 'file,udp,rtp', '-i', sdpFile];
}

// inputArgs = the ffmpeg args up to and including `-i <source>` (RTP SDP for the service,
// a lavfi tone for the self-check). Everything after is the fixed HLS output contract. Run in
// outDir with relative output names so segments + playlist land together with clean relative URIs.
export function startHls({ ffmpegPath, inputArgs, outDir, segmentSeconds = 6, window = 8, aacBitrate = '192k' }) {
  const args = [
    '-hide_banner', '-loglevel', 'warning',
    ...inputArgs,
    '-c:a', 'aac', '-b:a', aacBitrate, '-ar', '48000', '-ac', '2',
    '-f', 'hls',
    '-hls_time', String(segmentSeconds),
    '-hls_list_size', String(window),
    '-hls_segment_type', 'mpegts',
    '-hls_flags', 'delete_segments+append_list+omit_endlist',
    'stream.m3u8',
  ];
  const proc = spawn(ffmpegPath, args, { cwd: outDir, stdio: ['ignore', 'inherit', 'inherit'] });
  return proc;
}
