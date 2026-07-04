# Subspace Radio Restreamer

Standalone Node service. Pulls the live radio's `audio-main` track from the Cloudflare SFU (as an
anonymous listener, via the app's own `/api/rtc-session` broker — no Cloudflare secret), transcodes
it to deep-buffer **HLS** with ffmpeg, and publishes it so listeners get a 15-30s buffer that WebRTC
can't (no cuts, no BPM warp, survives mobile screen-lock). Writes `live_session.streamUrl` when a
stream is up; clears it when the show ends so listeners fall back to WebRTC.

**Not part of the Vite/Vercel build.** Plain ESM, no build step. Requires `ffmpeg` on PATH (or
`FFMPEG_PATH`).

```
                pull (anon listener)         ffmpeg              sink
DJ ─WebRTC→ CF SFU ───────────────→ werift ─Opus RTP→ AAC/fMP4 HLS ──→ local HTTP (dev)
                                                                    └─→ Cloudflare R2 (prod)
                                                                          │
station row (Supabase) ◀── writes live_session.streamUrl ─────────────────┘
```

## Run

```bash
npm install                 # ffmpeg must be installed separately
cp .env.example .env        # fill in staging values
npm run selfcheck           # proves the HLS output spine locally (no creds, no live broadcast)
npm start                   # watch the station; restream while it's live
```

## Files

| File | Role |
|------|------|
| `src/index.mjs` | Orchestrator: watch station → pull + transcode + publish → set/clear `streamUrl` |
| `src/station.mjs` | Station poll + `decideAction` state machine (unit-tested) + `streamUrl` writeback |
| `src/cfPull.mjs` | werift SFU pull (two-phase negotiate/commit). The proven spike, hardened |
| `src/hls.mjs` | ffmpeg → rolling fMP4/CMAF audio-only HLS |
| `src/sink/local.mjs` | Dev sink: serve HLS over HTTP with prod cache/CORS headers |
| `src/sink/r2.mjs` | Prod sink: mirror HLS to Cloudflare R2 (playlist last, immutable segments) |
| `src/selfcheck.mjs` | Live output-spine proof: tone → mux → serve → fetch → decode |
| `src/config.mjs` | Env load + ASCII-sanitize |

## Status

- **Proven:** SFU pull (spike, 2026-07-04), HLS output spine (`npm run selfcheck`, green),
  fMP4/CMAF format, state machine (`npm test`, 7/7).
- **Not yet run end-to-end:** live pull → HLS → published `streamUrl` against staging, and the R2
  sink (needs a bucket). Those are the staging integration step.
