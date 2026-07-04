// Pull the live `audio-main` track from the Cloudflare SFU, exactly like a browser listener, via
// the app's own broker (anonymous Supabase token -> subscribe-pull / subscribe-answer). No CF
// secret needed; it's read-only. Received Opus RTP is forwarded to a local UDP port that ffmpeg
// reads (see hls.mjs / index.mjs). This is the spike (proven green 2026-07-04) hardened into a
// reusable two-phase negotiate/commit so the caller can start ffmpeg BEFORE media starts flowing.
import { RTCPeerConnection, RTCRtpCodecParameters } from 'werift';
import dgram from 'node:dgram';

const noop = () => {};

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
    // falling back to one 20ms frame (960 @ 48kHz) when a delta looks like a reorder/garbage.
    // ffmpeg then sees a pristine, monotonic Opus stream.
    let seq = 0;
    let outTs = 0;
    let prevTs = null;
    track.onReceiveRtp.subscribe((rtp) => {
      // Skip empty (0-byte) DTX/padding packets — forwarding them adds nothing but noise and
      // trips ffmpeg's timestamp checks.
      if (!rtp.payload || rtp.payload.length === 0) return;
      rtpCount++;
      const orig = rtp.header.timestamp >>> 0;
      if (prevTs !== null) {
        let delta = (orig - prevTs) >>> 0; // unsigned 32-bit diff
        if (delta === 0 || delta > 48000 * 5) delta = 960; // reorder/garbage -> assume 20ms
        outTs = (outTs + delta) >>> 0;
      }
      prevTs = orig;
      rtp.header.sequenceNumber = seq & 0xffff;
      seq++;
      rtp.header.timestamp = outTs;
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
