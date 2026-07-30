# Radio listener-capacity fix — recap (2026-07-19)

## Problem
A live broadcast rejected 17+ listeners at entry ("tap to connect doesn't work") while ~18 were
connected. Question: how many can the room host, and what's needed for a reliable 100+.

## Diagnosis (top-down, live evidence)
1. **No cap in code.** Full sweep of `src/radio/` + `api/` — nothing counts or rejects listeners.
2. **Cloudflare cleared.** Realtime SFU free tier is bandwidth-only (1,000 GB/mo, ~0.26 Mbps/
   listener). Fine for hundreds. Not the bottleneck.
3. **Supabase was the wall.** Every listener does an anonymous sign-in at TUNE IN
   (`EntryGate.tsx`). Supabase free-tier default caps anonymous sign-ins at **30/hour, per IP**.
   The dashboard confirmed "per IP address" — the distributed-listener wall is explained by phones
   sharing carrier/CGNAT public IPs, pooling the 30/hr. 18 in + 17 rejected ≈ 35 > 30.
4. **Code made it worse:** `api/rtc-session.ts` re-verified each token via `getUser()` on every
   RTC phase (extra load on the same auth service), and collapsed the real reason into a generic
   401 — so the rejection was invisible in logs.
5. **Last night's logs were gone** — Vercel keeps runtime logs only briefly ("No logs found").
   Retro-confirmation impossible; had to fix + instrument forward.

## Fix
- **Account (the actual fix, free, live immediately):** Supabase Dashboard -> Authentication ->
  Rate Limits -> "anonymous users" 30 -> 300.
- **Code (PR #7, merged to master `b2b799b`):**
  - `api/rtc-session.ts`: 60s per-token verification cache (fewer `getUser` calls); return a
    `reason` (`rate_limited` vs `invalid_token`) and log it, so a future rejection is provable.
  - `EntryGate.tsx`: calm "Room is busy" message on a rate-limit.
  - `docs/RADIO-CAPACITY.md`: owner guide (dashboard steps + load test).
  - `scripts/radio-loadtest.mjs`: capacity load tester (+ POOL mode for CF-pull stress).
  - `CLAUDE.md`, `docs/RADIO-BETA-TEST-AND-LAUNCH-GUIDE.md`: capacity notes.
  - Audio path (publisher/subscriber/jitter buffer) untouched.

## Verification (preview + a real live broadcast)
- 100 listeners (sign-in + audio pull): **100/100**, 0 rejected. At the old 30/hr, ~70 would fail.
- POOL-mode CF stress (reuse 20 logins, bypass per-IP cap): **300 -> 299/300** (1 transient CF
  502), **500 -> all server-reached pulls ok, 0 server rejections** (72 "fetch failed" were
  single-host local socket exhaustion, not a server/CF limit).
- Bad token on preview + prod -> `reason: invalid_token` (new code confirmed live).
- Local: build clean, 369 tests pass.
- Prod verified: subspaceresonator.com healthy (12 og tags), `/radio` 200, API returns `reason`.

## Key facts to remember
- The capacity ceiling is **Supabase free-tier anonymous sign-in rate limit (per IP)** — not
  Cloudflare, not code. Raise it in the dashboard.
- Anonymous sign-in needs **no captcha** currently (probed) — load tests run without disabling
  Turnstile.
- Beyond ~150 (or to fix phone-lock audio), the HLS restream is the path — already proven, see
  `project_radio_hls_restream_spike`.
- Load tests create throwaway anonymous users; clean up with an admin `deleteUser` sweep filtered
  to `is_anonymous` + recent `created_at` (a bulk delete may be blocked by the agent sandbox and
  need to be run by the owner).
