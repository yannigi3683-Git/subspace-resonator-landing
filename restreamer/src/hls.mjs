// ffmpeg HLS muxer. Reads audio (RTP from the SFU pull, or any ffmpeg input), writes a rolling
// fMP4/CMAF audio-only HLS playlist. fMP4 (not mpegts) is the iOS-validated audio-only format.
// Deep buffer lives on the CLIENT (hls.js/native config); here we just keep a small rolling window.
import { spawn } from 'node:child_process';

// inputArgs = the ffmpeg args up to and including `-i <source>` (RTP SDP for the service,
// a lavfi tone for the self-check). Everything after is the fixed HLS output contract.
// ffmpeg resolves `-hls_fmp4_init_filename` relative to its CWD, so we run it IN outDir with
// relative output names; init.mp4 + segments + playlist then all land together and the
// #EXT-X-MAP / segment URIs stay clean relative names the sink can serve.
export function startHls({ ffmpegPath, inputArgs, outDir, segmentSeconds = 6, window = 8 }) {
  const args = [
    '-hide_banner', '-loglevel', 'warning',
    ...inputArgs,
    '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
    '-f', 'hls',
    '-hls_time', String(segmentSeconds),
    '-hls_list_size', String(window),
    '-hls_segment_type', 'fmp4',
    '-hls_fmp4_init_filename', 'init.mp4',
    '-hls_flags', 'delete_segments+append_list+independent_segments+omit_endlist',
    'stream.m3u8',
  ];
  const proc = spawn(ffmpegPath, args, { cwd: outDir, stdio: ['ignore', 'inherit', 'inherit'] });
  return proc;
}
