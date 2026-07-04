// ffmpeg HLS muxer. Reads audio (RTP from the SFU pull, or any ffmpeg input), writes a rolling
// audio-only HLS playlist with MPEG-TS segments. mpegts (not fMP4) is used deliberately: fMP4
// segmenting off a live RTP source produced a duplicated-MOOV / stretched-timeline bug (audio
// played ~3x slow); mpegts AAC is rock-solid, plays natively on iOS AND via hls.js, and was the
// format the original spike decoded clean. Deep buffer lives on the CLIENT (hls.js/native config).
import { spawn } from 'node:child_process';

// RTP-from-SDP input flags. cfPull re-stamps the RTP with clean monotonic sequence numbers and
// timestamps, so ffmpeg can use them directly (no genpts/wallclock hacks needed).
export function rtpInputArgs(sdpFile = 'input.sdp') {
  return ['-protocol_whitelist', 'file,udp,rtp', '-i', sdpFile];
}

// inputArgs = the ffmpeg args up to and including `-i <source>` (RTP SDP for the service,
// a lavfi tone for the self-check). Everything after is the fixed HLS output contract. Run in
// outDir with relative output names so segments + playlist land together with clean relative URIs.
export function startHls({ ffmpegPath, inputArgs, outDir, segmentSeconds = 6, window = 8 }) {
  const args = [
    '-hide_banner', '-loglevel', 'warning',
    ...inputArgs,
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
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
