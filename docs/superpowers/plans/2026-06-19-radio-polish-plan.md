# Subspace Radio — Polish & Feature Work Plan (2026-06-19)

Status: broadcast works **end to end** on preview `feat/radio-room` (host → Cloudflare SFU →
listener audio confirmed). This plan covers everything raised after that milestone. Execute with
**subagent-driven-development** (fresh implementer subagent per task → spec review → code-quality
review), **TDD** per task, and **systematic-debugging** for the bug tasks (root cause via
`npx vercel logs <url> --json` BEFORE any fix). Do **not** merge to `master` until Phase F.

Order approved by user: **A (quick wins) → B (host player)**, then C/D/E, then F.

---

## Phase A — Quick wins (low risk, high impact)

### A1 — Chat send works (DB)
- **Symptom:** listener chat shows `permission denied for table chat_messages`.
- **Cause class:** table-level GRANT missing and/or no INSERT RLS policy (same pattern as
  `station`; see recap). RLS policy is necessary but NOT sufficient without the GRANT.
- **Do:** in Supabase SQL editor —
  ```sql
  grant select, insert on table public.chat_messages to anon, authenticated;
  -- ensure an INSERT policy exists (adjust column to chat_messages' identity col):
  drop policy if exists chat_insert_own on public.chat_messages;
  create policy chat_insert_own on public.chat_messages
    for insert to anon, authenticated with check (true);
  drop policy if exists chat_read_all on public.chat_messages;
  create policy chat_read_all on public.chat_messages for select using (true);
  ```
- **Verify:** listener posts a message; it appears for both windows; no console error.

### A2 — Audio stability (fewer dropouts)
- **Cause class:** 256 kbps stereo Opus exceeds unstable upload; jitter/CPU.
- **Do (TDD):** `src/radio/rtc/publisher.ts` `applyFr4Bitrate` — lower `maxBitrate` 256k → 128k
  (consider exposing a quality setting later). Keep DTX off.
- **Verify:** smoother playback on the host's connection; note wired-ethernet guidance for HQ.

### A3 — Kill the "CONNECTING…" hang
- **Cause:** publish-offer 500 (e.g. `station_update_failed`) is retried forever; FSM reaching
  `lost` never updates the UI.
- **Do (TDD):**
  - `publisher.ts`: treat HTTP **500** as fatal (`onFatal`) — config errors don't fix on retry;
    keep 502/503/network retryable.
  - `GoLivePanel.tsx` `dispatchFsm`: when `fsmRef.current.status === 'lost'`, set status `error`
    + message ("Connection lost — check network and try again").
- **Verify:** a forced publish failure surfaces an error instead of an endless spinner.

---

## Phase B — Host player (the broadcaster's deck)

`LocalDeck` already supports `advance/previous/jumpTo/current/next`. A single
`MediaElementSource` per session is fine; **swap `audio.src`** to change tracks (do NOT call
`createMediaElementSource` twice on one element).

### B1 — Visible playlist
- **Do:** render the queue as a list; highlight `currentIndex`; click row → `jumpTo` (+ play when
  live); keep REMOVE. Show when ≥1 file.
- **Verify (TDD):** list shows all tracks, current highlighted; click selects/jumps.

### B2 — Transport: prev / play-pause / next + auto-advance
- **Do:** controls operate on the live file element (swap src + play/pause). `audio.onended` →
  `advance()` → play next; stop at end of queue.
- **Verify (TDD):** next/prev switch the playing track; track end auto-advances.

### B3 — 10-second seek (back/forward)
- **Do:** −10s / +10s buttons → `audio.currentTime ± 10` (clamped).
- **Verify:** seek moves playback position; clamps at 0 and duration.

### B4 — Auto-mix crossfade (1–12 s, Spotify-style)
- **Do:** dual-deck in `hostMixer` — two file `MediaElementSource`s + `GainNode`s; near track end
  (within the configured fade window), start the next track and ramp gains (equal-power or linear)
  over the slider value (1–12 s). Add a "AUTO-MIX" toggle + seconds slider to the host UI.
- **Verify (TDD where pure):** crossfade scheduler picks the right start time; gain ramp math;
  manual listen test for smoothness.

### B5 — "What's going out" clarity
- **Do:** keep OUTPUT LEVEL but label clearly; add a mic/input indicator and a prominent NOW
  PLAYING with elapsed/remaining (tabular figures).
- **Verify:** host can tell at a glance whether mic and/or a file is being broadcast.

---

## Phase C — Guest (listener) experience

### C1 — Real avatars (replace 2-letter initials)
- **Cause:** presence renders initials; the planned psy avatar pack isn't wired to a visual.
- **Do:** create an SVG avatar set (deterministic from `avatarId`); render in `DanceFloor`,
  `PresenceList`, `Chat`. No emoji.
- **Verify:** each listener shows a distinct graphic avatar; consistent across surfaces.

### C2 — Listener player polish
- **Do:** style the tap-to-listen/volume/now-playing; show connection state; respect
  `prefers-reduced-motion`; 44px touch targets.

---

## Phase D — UI / visual pass (ui-ux-pro-max checklist, web)
- **Do:** align radio with the landing-page aesthetic (Space Grotesk / Inter / JetBrains Mono,
  dark, `section-border`); audit contrast (4.5:1), focus rings, states (hover/active/disabled),
  responsive (375/768/1024), no-emoji SVG icons, animation 150–300ms transform/opacity only.
- **Verify:** ui-ux-pro-max §1–§5 pass; looks consistent with the main site.

---

## Phase E — Robustness / QA
- Reconnection UX; release the host CF session on END; CSP cleanup (Turnstile/`vercel.live`
  console noise); abuse-case matrix; 1× rehearsal broadcast.

---

## Phase F — Production (only on explicit approval)
- `superpowers:finishing-a-development-branch`: final review → merge `feat/radio-room` → `master`
  (auto-deploys). Smoke-test live: GO LIVE + incognito listener + chat.

---

## Execution notes
- One implementer subagent per task; provide full task text + the recap's "stack map" as context;
  do not make subagents re-derive this session.
- DB tasks (A1, and any GRANT/policy) are **user-run SQL** — provide exact statements, then verify.
- After each task: spec-compliance review, then code-quality review, then mark complete.
- Keep all work on `feat/radio-room`; verify the **served bundle hash** after each deploy (stale
  preview URLs are the #1 "my fix didn't work" trap — see recap).
