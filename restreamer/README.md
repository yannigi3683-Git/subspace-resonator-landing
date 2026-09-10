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

`selfcheck` resolves `ffmpeg`/`ffprobe` from **PATH** unless `FFMPEG_PATH`/`FFPROBE_PATH` are set. It
deliberately does not read `.env`: its job includes proving a *fresh* machine works before `.env` has
been edited, and absolute fallbacks (previously one host's WinGet paths) made it fail everywhere else
for a reason unrelated to what it tests.

**Machine-portable.** No native dependencies (verified: zero `.node`/`binding.gyp` in the tree), so
the folder can be copied to another Windows PC as-is, `node_modules` included, with no reinstall. The
only machine-specific value is `FFMPEG_PATH`. Host-facing walkthrough: "Moving it to another
computer" in `HOW-TO-RUN.md`. **One instance only** — see the gaps below.

## Files

| File | Role |
|------|------|
| `src/index.mjs` | Orchestrator: watch station → pull + transcode + publish → set/clear `streamUrl` |
| `src/station.mjs` | Station poll + `decideAction` state machine (unit-tested) + `streamUrl` writeback. `setStreamUrl` takes the cfSessionId it is writing for and bails if the host has since re-published: it rewrites the whole `live_session` jsonb with the service-role key, so an unguarded write would revert the row to a dead session |
| `src/cleanup.mjs` | Per-attempt teardown (kill ffmpeg, close pull, stop sink, remove temp dir). The temp-dir removal is best-effort: ffmpeg runs with `cwd=outDir` and Windows will not delete a live process's cwd, so an EPERM there is logged, never thrown. Letting it throw once masked the real startup error (2026-07-26) |
| `src/cfPull.mjs` | werift SFU pull (two-phase negotiate/commit). The proven spike, hardened |
| `src/hls.mjs` | ffmpeg → rolling fMP4/CMAF audio-only HLS |
| `src/sink/local.mjs` | Dev sink: serve HLS over HTTP with prod cache/CORS headers |
| `src/sink/r2.mjs` | Prod sink: mirror HLS to Cloudflare R2 (playlist last, immutable segments) |
| `src/selfcheck.mjs` | Live output-spine proof: tone → mux → serve → fetch → decode |
| `src/config.mjs` | Env load + ASCII-sanitize |
| `src/log.mjs` | Timestamped `log()` that tees the console to `logs/YYYY-MM-DD.log` (unit-tested). The console window dies with the process and the host is normally not watching it, so an unattended event left no record: reconstructing one host reconnect on 2026-08-21 took an R2 bucket listing plus a process-start-time check. A log dir that cannot be written is abandoned permanently rather than retried, because a full disk must never take a live broadcast down |

## Status

**Shipped and in routine use.** Proven end-to-end on a real phone 2026-07-05: live SFU pull → HLS →
published `streamUrl` → listener crossfade, against the production R2 sink (bucket `radio-hls`).
Later fixes landed against that live sink (`c2015fb` R2 scan-overlap, `01b837d` 192k AAC).

Host-facing operating instructions live in `HOW-TO-RUN.md`. The host sees whether this is running
from the **DEEP BUFFER** badge in the console (`src/radio/admin/GoLivePanel.tsx`), which polls the
published playlist rather than trusting `streamUrl`, so a PC that dies without clearing the row
shows `STALLED` instead of a false green.

Known gaps, deliberate: no remote start (a manual double-click on one Windows PC), no
single-instance guard, and nothing ever deletes objects from R2 (a bucket lifecycle rule, not code).
