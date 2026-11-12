// Pull the live `audio-main` track from the Cloudflare SFU, exactly like a browser listener, via
// the app's own broker (anonymous Supabase token -> subscribe-pull / subscribe-answer). No CF
// secret needed; it's read-only. Received Opus RTP is forwarded to a local UDP port that ffmpeg
// reads (see hls.mjs / index.mjs). This is the spike (proven green 2026-07-04) hardened into a
// reusable two-phase negotiate/commit so the caller can start ffmpeg BEFORE media starts flowing.
import { RTCPeerConnection, RTCRtpCodecParameters } from 'werift';
import dgram from 'node:dgram';

const noop = () => {};

// Returns { seq, ts } for a packet to forward, or null to drop it. A packet whose timestamp is not
// AHEAD of the last forwarded one is not new audio: since Chrome 157 (2026-11-12) the host sends a
// burst of 3-4 same-timestamp packets every 5s, and stamping each as a fresh 20ms frame spliced
// ~80ms of junk into the stream, heard by every deep-buffer listener as a bump. The delta is SIGNED
// so a burst packet (or a late real frame) arriving after the next frame is dropped too, instead of
// looking like a 2^32 jump and rewinding prevTs. `| 0` keeps a 32-bit timestamp wrap a small step.
export function makeRestamper() {
  let seq = 0;
  let outTs = 0;
  let prevTs = null;
  return (timestamp) => {
    const orig = timestamp >>> 0;
    if (prevTs !== null) {
      let delta = (orig - prevTs) | 0;
      if (delta <= 0) return null;
      if (delta > 48000 * 5) delta = 960; // garbage forward jump -> assume one 20ms frame
      outTs = (outTs + delta) >>> 0;
    }
    prevTs = orig;
    return { seq: seq++ & 0xffff, ts: outTs };
  };
}

export async function negotiatePull({ brokerUrl, token, rtpPort, host = '127.0.0.1', log = noop }) {
  const post = (body) =>
    fetch(brokerUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  const pullRes = await post({ phase: 'subscribe-pull' });
  if (!pullRes.ok) {
    throw new Error(`subscribe-pull ${pullRes.status}: ${await pullRes.text()} (is the station live?)`);
  }
  const { cfSessionId, cfOffer } = await pullRes.json();
  const opusPt = Number((cfOffer.match(/a=rtpmap:(\d+)\s+opus\/48000/i) || [])[1] || 111);
  log('subscribe-pull OK', cfSessionId, 'opusPt', opusPt);

  const udp = dgram.createSocket('udp4');
  // A send that lands after close() - a packet still in flight while the pull is torn down -
  // emits 'error' here, and an unhandled 'error' on a dgram socket takes the whole process down
  // mid-teardown. Log and carry on; the socket is going away anyway.
  udp.on('error', (e) => log('rtp socket', e.message));
  const pc = new RTCPeerConnection({
    codecs: {
      audio: [new RTCRtpCodecParameters({ mimeType: 'audio/opus', clockRate: 48000, channels: 2, payloadType: opusPt })],
    },
  });

  let rtpCount = 0;
  let attached = false;
  pc.onTrack.subscribe((track) => {
    if (track.kind !== 'audio' || attached) return;
    attached = true;
    // werift delivers RTP slightly out of order (network jitter, no jitter buffer on this path).
    // ffmpeg's RTP demuxer panics on a backward sequence number ("missed 65534 packets") and its
    // timestamps go non-monotonic -> the HLS segmenter stretches audio ~2x slow. Fix: re-stamp
    // each packet in arrival order with our OWN monotonic sequence number and timestamp, advancing
    // the timestamp by the original inter-packet delta (so variable Opus frame sizes are honored),
    // dropping a packet that is not ahead of the last one (see makeRestamper).
    // ffmpeg then sees a pristine, monotonic Opus stream.
    const restamp = makeRestamper();
    let dropped = 0;
    track.onReceiveRtp.subscribe((rtp) => {
      // Skip empty (0-byte) DTX/padding packets — forwarding them adds nothing but noise and
      // trips ffmpeg's timestamp checks.
      if (!rtp.payload || rtp.payload.length === 0) return;
      rtpCount++;
      const out = restamp(rtp.header.timestamp);
      if (!out) {
        // Visible in logs/ so a future Chrome change shows up as "drops stopped" or "bumps with 0 drops".
        if (++dropped % 100 === 1) log('dropped same-or-older-timestamp rtp packets:', dropped);
        return;
      }
      rtp.header.sequenceNumber = out.seq;
      rtp.header.timestamp = out.ts;
      udp.send(rtp.serialize(), rtpPort, host);
    });
  });
  pc.connectionStateChange?.subscribe?.((s) => log('cf connectionState', s));

  await pc.setRemoteDescription({ type: 'offer', sdp: cfOffer });
  await pc.setLocalDescription(await pc.createAnswer());
  await new Promise((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const to = setTimeout(res, 3000);
    pc.iceGatheringStateChange.subscribe((s) => { if (s === 'complete') { clearTimeout(to); res(); } });
  });

  return {
    opusPt,
    cfSessionId,
    rtpCount: () => rtpCount,
    // Send the answer -> media starts flowing. Call only after ffmpeg is listening on rtpPort.
    async commit() {
      const ans = await post({ phase: 'subscribe-answer', cfSessionId, sdpAnswer: pc.localDescription.sdp });
      if (!ans.ok) throw new Error(`subscribe-answer ${ans.status}: ${await ans.text()}`);
      log('subscribe-answer OK, media flowing');
    },
    close() {
      try { pc.close(); } catch {}
      try { udp.close(); } catch {}
    },
  };
}
