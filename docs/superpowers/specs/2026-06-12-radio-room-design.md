# Subspace Radio — Design Spec (P1 "The Room, Live From the Source")

Status: approved 2026-06-12 (3 decision rounds, PRD review, 2 security reviews, 1 architecture pivot).
Full planning record: `~/.claude/plans/i-want-you-to-functional-hopcroft.md`.

## Vision

One link: subspaceresonator.com/radio. Yanni presses GO LIVE on his own device (desktop/laptop/phone, WiFi or 4G) and his sound is on the air. Fans tune in with zero signup, hear the live stream (sub-second latency, inherently in sync), hang out in chat as psychedelic avatars, and watch a real Milkdrop (Winamp) visualizer. The station lives and dies with the host's device, on purpose. Nothing is uploaded; no cloud music storage exists in P1.

## Why device-first (decision record)

- Streaming-service audio (Spotify/YouTube/Bandcamp) can never be mixed, synced, or visualized: DRM, CORS, 30s embed previews, and Spotify's Feb 2026 API crackdown. Every predecessor (turntable.fm, plug.dj, JQBX) died building on other people's music. Yanni owns his catalog; the station plays only content he controls.
- Yanni rejected cloud file storage as the core; the upload locker (walk-away marathons with his devices off) is fully designed and deferred as Phase L.
- Relay vendor: Cloudflare Realtime SFU (1,000 GB/month free ≈ 5 full 48h 30-listener marathons; LiveKit free tier = 5,000 participant-minutes/month, dead in one evening).

## Architecture

- `/radio` = second Vite MPA entry (`radio.html`), landing bundle untouched; vercel.json rewrite + security headers (CSP, HSTS, frame-ancestors, nosniff, Permissions-Policy).
- Supabase (project `lgcmbmlapksmdbkhkyyv`): Postgres (station singleton, scheduled_shows, bans, kicks, chat_messages, admin_audit) + Realtime private channel `room:main` (presence + postgres_changes) + Auth.
- Identity: listeners are Turnstile-gated anonymous Supabase sessions (invisible captcha at TUNE IN; no registration). Host = Yanni's account with TOTP MFA; all admin writes require `aal2` enforced in RLS.
- RTC: Cloudflare Realtime SFU, brokered by `api/rtc-session.ts` (Vercel function holding the app secret). Host JWT (admin+aal2) → publish session; anon session JWT → subscribe-only. Publish quality: stereo Opus ~256kbps, voice processing disabled, DTX off.
- Host console sources, mixed in Web Audio: audio input device (Traktor master routed in), local-file deck (files played from disk, never uploaded), microphone. Per-source gains, master meter.
- Listener pipeline: remote MediaStream → audio element (gesture-unlocked) → MediaStreamAudioSource → Gain (volume; element volume is dead on iOS) → AnalyserNode → Butterchurn visualizer (pinned 2.6.7, lazy chunk) with first-party spectrum-canvas fallback.
- Resilience: connection state machine with exponential backoff both sides; SIGNAL LOST state, never a dead page; Opus adapts to weak host uplink (one ~0.26 Mbps stream up).

## Functional requirements (MUSTs)

Modes OFF/LIVE propagate <2s · host console behind MFA (GO LIVE/END, title, sources+gains+meter, listener count, moderation) · local-file deck with queue · publish quality per above · auto-reconnect + SIGNAL LOST · no listener auth (avatar + name + TUNE IN gesture) · sub-2s typical latency · now-playing + Media Session · visualizer with fallback + reduced-motion · iOS Safari 16+/Android Chrome/desktop browsers · chat (HOST badge server-verified, 500-char cap) · presence list + count · kick/ban/slow/lock (DB rows under RLS, unforgeable) · last-50 history, 48h TTL, zero PII · RADIO nav item + ON AIR dot (raw REST fetch, landing bundle untouched) · static OG card for /radio · soft cap ~150 (SHOULD) · scheduled-show countdown (SHOULD) · GA4 events (SHOULD).

## Security (OWASP ASVS L2 mapped, 2 committee passes)

RLS single-writer; aal2 step-up for all admin writes; Turnstile-gated anon sessions; private Realtime channel; publish authorization host-only; plain-text chat; CSP/HSTS/nosniff/frame-ancestors/Permissions-Policy; secrets server-side only; pinned deps + Dependabot + npm audit; admin_audit trail; uptime monitor; security.txt; abuse-case test matrix in QA (REST writes with anon key, subscribe without JWT, publish with listener JWT, is_host spoof, XSS batch, ban-rejoin, captcha replay). Honest limits accepted: funded DoS downs the free tier for the attack's duration (recovery posture: lock → OFF → Vercel Attack Challenge Mode); the live stream can be recorded by any listener (true of all radio).

## Out of scope (P1)

Upload locker / walk-away marathons (Phase L, designed) · full browser DJ deck (waveforms/beatmatch) · recordings/archive · social auto-posting · reactions.

## Future scope — tracked, not yet built

- **Host from Android/mobile** (raised 2026-06-19): hosting from Android Chrome works for the
  microphone (and phone DJ apps that expose audio) since Android supports getUserMedia + WebRTC
  publish. Blockers to resolve when picked up: (a) reaching `#admin` without a keyboard shortcut —
  solved by the admin-only nav link (radio polish Phase E); (b) mobile audio-source selection; (c)
  Traktor/virtual-cable routing stays desktop-only (phones can't route a DJ app into the browser).
  Own spec when scheduled.

## Milestones

M1 MPA shell+infra → M2 schema+auth → M3 RTC core (round-trip proven) → M4 host console → M5 identity+chat+presence → M6 visualizer → M7 standby+nav+OG+GA4 → M8 moderation+polish+QA gate (abuse matrix, real devices, 4G host test, 2h rehearsal broadcast). Every milestone: `npm run build` + `npm test` clean, test count never drops.
