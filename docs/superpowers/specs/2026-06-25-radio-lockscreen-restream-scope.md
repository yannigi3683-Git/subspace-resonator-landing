# Subspace Radio — lock-screen audio via server restream (scoping)

**Status:** research / decision doc. No code. Created 2026-06-25.

## Problem

Listener audio is a live **WebRTC `MediaStream`** (`audio.srcObject` in `useListenerAudio.ts`).
iOS Safari and mobile browsers **suspend MediaStream/WebRTC audio when the screen locks or the tab
backgrounds** — there is no browser API to keep it alive (Wake Lock releases on lock; MediaSession
only controls file/HLS `<audio src>` media, not live WebRTC). Current mitigation: the resume tap
rebuilds the connection on reopen. True uninterrupted lock-screen playback (Spotify/podcast-style)
requires the audio to arrive as **standard streamable media**, not WebRTC — i.e. a **server-side
restream**.

## What "fixed" looks like

Listener plays `<audio src="…m3u8 | …mp3">` (HLS or Icecast/MP3). The browser then treats it as
background media: keeps playing on lock, shows lock-screen transport controls + MediaSession
metadata (title/artist/art — the latent artwork feature could feed this). Trade-off: **higher
latency** (segmented/buffered, ~5-30s vs WebRTC's sub-second) — acceptable for radio, not for
2-way.

## The bolt-on point

Today: host `publisher.ts` → **Cloudflare Realtime SFU** → listener `subscriber.ts` (WebRTC pull).
A restream taps the **same host audio** and republishes it as HLS/Icecast. The host publish path and
the existing WebRTC listener path can stay (offer "low-latency" vs "background" modes), or the
restream becomes the default listener transport.

## Options

| Option | How it works | Latency | Cost | Effort | Notes |
|---|---|---|---|---|---|
| **Cloudflare Stream Live** | Push the broadcast (RTMP/SRT or WHIP from the SFU egress) to CF Stream Live → it emits HLS/DASH. Listener plays the HLS URL. | ~10-30s (LL-HLS less) | CF Stream pricing (per-min delivered + storage) | **Medium** — stays in the Cloudflare ecosystem already used; need an egress from SFU → Stream (RTMP/WHIP), and an `hls.js`/native `<audio>` player on the listener | Best fit: same vendor, managed, scales. Verify SFU→Stream ingest path exists for audio-only. |
| **Icecast (MP3/AAC)** | Run/rent an Icecast server; a source client (e.g. `ffmpeg`/`liquidsoap`) pulls the SFU/host audio and feeds Icecast. Listener plays the stream URL in `<audio>`. | ~2-10s | A small always-on VPS or managed Icecast (cheap) | **Medium-High** — must run a source pipeline (host audio → ffmpeg → Icecast) somewhere always-on; Vercel functions are not long-running, so needs a separate worker/box | Simplest player side (plain MP3 `<audio>`, universal). Ops burden = the source box. |
| **Self-hosted HLS (ffmpeg segmenter)** | `ffmpeg` segments the host audio to `.m3u8`+`.ts`/`.aac` on object storage/CDN; listener plays via `hls.js`. | ~6-20s | CDN/storage + a segmenter worker | **High** — you own segmenting, retention, CDN wiring, LL-HLS tuning | Most control, most work. Only if CF Stream is unsuitable. |

## Cross-cutting work (any option)

- **Egress from the SFU:** need the host's mixed audio as a continuous stream to feed the restream.
  Either a server-side WHIP/RTMP egress from Cloudflare Realtime, or have the host page also push a
  second encoder output. Confirm Cloudflare Realtime supports an audio egress to Stream Live.
- **Listener UX:** a toggle or auto-pick — "Live (low latency, dies on lock)" = current WebRTC vs
  "Background (survives lock, delayed)" = HLS/Icecast. Or default everyone to the restream and drop
  WebRTC for listeners (simplest, but adds latency for all).
- **MediaSession metadata + lock-screen controls:** wire title/artist (and revive the **latent
  artwork** `extractArtwork`) into `navigator.mediaSession` so the lock screen shows real info.
- **Always-on source process:** Vercel functions can't host the long-lived encoder. Needs a worker
  (CF Workers/Durable Object, a small VPS, or a container) — a new infra piece this project doesn't
  have yet.
- **Cost model:** delivery scales with listener-minutes; estimate expected concurrent listeners ×
  hours before committing.

## Recommendation (for a later decision)

Start with **Cloudflare Stream Live** if Cloudflare Realtime can egress audio to it — keeps one
vendor, no new always-on box to babysit, managed scaling. Fall back to **Icecast** if a simple
MP3 stream + a small source box is cheaper/simpler for the expected (small) audience. Keep the
current WebRTC listener path as the "low-latency" option; add the restream as the "background"
default on mobile.

**Next action when greenlit:** spike the SFU→Stream(or Icecast) egress for one broadcast, measure
real latency + cost, then design the listener mode toggle. Until then, the resume-tap reconnect is
the shipped mitigation. See `project_radio_screenlock_constraint` memory + CLAUDE.md radio section.
