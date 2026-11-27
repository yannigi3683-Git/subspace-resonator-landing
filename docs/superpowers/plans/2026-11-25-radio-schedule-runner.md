# Radio SCHEDULE RUNNER: Implementation Plan (Release 2)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:test-driven-development` (failing test first, every task), then `superpowers:executing-plans`. Checkbox steps. **Starts only after Release 1 (`plans/2026-11-25-radio-schedule.md`) is merged and has run one real show, and the owner has signed off the SCHEDULE RUNNER journeys.**

**Goal:** A console left open and armed on the owner's PC goes live at each scheduled show's time, plays the files assigned to it, and ends when they finish.

**Spec:** `docs/superpowers/specs/2026-11-25-radio-schedule-runner-design.md` (decisions A0-E6, failure matrix, red-team cycles).

**Architecture:** A pure state machine (`scheduleRunner.ts`) decides what to do each tick from the server clock, the show list, the station row, preflight results and deck events. `useScheduleRunner` (in `AdminConsole`) runs it and drives `GoLivePanel` through a small imperative handle that only calls the panel's existing GO LIVE, deck and END handlers. Show files live in the PC's browser storage (`showFiles.ts`, OPFS + IndexedDB). A singleton `runner_status` row carries the lease and heartbeat, read by the owner's phone.

**Branch:** `feat/radio-schedule-runner` off `master` after Release 1 merges.

**Broadcast id (spec cycle A9.1):** everywhere below, "broadcast id" means `live_session.startedAt`, not `cfSessionId`, because a host reconnect mints a new `cfSessionId` mid-show. That covers `expect`, the `runner_status` column (`broadcast_started_at`) and the watchdog.

**Never touched:** `src/radio/rtc/*` (publisher, subscriber, mixer internals, ICE, jitter buffer), `restreamer/*`, listener audio hooks. `GoLivePanel.tsx` changes are fenced by the Task 5 diff gate. **`api/rtc-session.ts` gets one additive, optional condition (Task 1b) and nothing else.**

---

## Task 1: schema

- [ ] **1.1** `scheduled_shows.neon_mode` (`tracks` | `title`, default `tracks`).
- [ ] **1.2** `runner_status` singleton: device id and label, armed, heartbeat_at, state, next_show_id, message. RLS: select/insert/update only when `is_admin_aal2()`; nothing for anon or listeners. Grants to authenticated (guarded by `grants.test.ts`).
- [ ] **1.3** RPCs `runner_claim(_lease_id, _label)` and `runner_beat(_lease_id, _state, _next, _cf_session_id, _message)`: security invoker, `set search_path = public`, server clock for the 3-minute lease; `_lease_id` is a random per-tab id held in memory. Execute granted to authenticated.
- [ ] **1.3b** Watchdog job (pg_cron, every minute): if `runner_status.state = 'on_air'`, the heartbeat is over 5 min old and `station.live_session->>'cfSessionId'` equals `runner_status.cf_session_id`, set the station off air exactly as END does. Phase 0 confirms `pg_cron` is enabled. SQL test cases written as probe steps: manual show untouched; fresh heartbeat untouched; stale SCHEDULE RUNNER show ended.
- [ ] **1.4** Probes (on the Release 1 probe harness): anon and an anonymous listener cannot read `runner_status`, cannot claim, cannot beat; self-test proves each probe can fail.
- [ ] **1.5** Delta file for the owner, applied off air.

## Task 1b: server condition (`api/rtc-session.ts`)

- [ ] **1b.1 Failing tests** in the existing `api/` test style: `publish-offer` **without** `expect` performs the same station write as today (regression lock); with `expect: 'off'` the write is conditional on `mode = 'off'` and a miss returns 409 `station_busy` (Cloudflare session closed, not leaked); with `expect: <id>` it is conditional on that `cfSessionId`; `end-broadcast` with `expect` ends only on a match and returns 409 otherwise; without it, unchanged.
- [ ] **1b.2** Implement. Every relative import keeps its `.js` (guarded by `api/importExtensions.test.ts`).
- [ ] **1b.3** Preview: `npm run check:api -- <preview>/api/rtc-session` prints `API ALIVE`; one manual GO LIVE / END on the preview behaves as before.
- [ ] **1b.4** Commit: `feat(radio): optional expect condition on publish and end`.

## Task 2: `scheduleRunner.ts` state machine (pure)

- [x] **2.1 Failing tests** with an injected clock (`src/radio/scheduleRunner.test.ts`, 35 tests, 2026-11-27):
  - States `off → armed → preflight (T-10) → starting (T-45 s, empty deck) → on_air (deck loaded and playing at T) → ending (30 s after queue finished, or hard END at start + total + 2 min) → armed`, and at least 15 s before the next start.
  - A failed attempt that left the station live with SCHEDULE RUNNER's own id: the retry resumes it; MISSED ends it with `expect`.
  - A file error during SCHEDULE RUNNER skips to the next file.
  - Preflight failure retries every 30 s; still failing at T: start attempts every 30 s until T+30 min, then `missed`.
  - Station already live at T-45 s: no GO LIVE; `failed: already live`; re-checked every 30 s until T+30 min.
  - Show without files on this PC: skipped, reported from T-24 h.
  - Overrun: next show waits for `ending` of the previous, then starts at once.
  - `lost` while on air: sends the reconnect event (as the `online` handler does) every 30 s until connected; never a fresh GO LIVE, never a deck reload.
  - Host presses END during a show: show done, no retry; DISARM: no future starts.
  - Clock jumps (sleep/resume): a start time already more than 30 min past is `missed`, never started late.
  - Totality: bad dates, empty lists, unknown states never throw.
- [x] **2.2** Implement (`src/radio/scheduleRunner.ts`). **2.3** Commit.

## Task 3: `showFiles.ts` (local playlists)

- [x] **3.1 Failing tests** (`src/radio/showFiles.test.ts`, 17 tests, 2026-11-27) against an in-memory storage adapter (jsdom has no OPFS): add copies with progress; a failed copy leaves nothing behind; list order; reorder; display names; remove; verify (missing file or size mismatch reported by name); orphan detection; `persist()` result surfaced; `estimate()` surfaced.
- [x] **3.2** Implement with an OPFS adapter + IndexedDB for metadata; adapter chosen at runtime (`src/radio/showFiles.ts`; `makeName` exported from `rtc/localDeck.ts` so the neon line names files exactly as the deck does). A file the browser cannot play is rejected before it is copied. The OPFS and IndexedDB adapters cannot run in jsdom; V-A5 checks them on the owner's PC. **3.3** Commit.

## Task 4: playlist editor in `SchedulePanel`

- [ ] **4.1 Failing tests:** FILES row states (none / n files and length / assign on the broadcasting PC); editor add, reorder (drag and up/down buttons), remove, display name, NEON toggle saved to the show; total length; overrun warning text; storage line (protected / may be cleared); 44 px targets; no em dash.
- [ ] **4.2** Implement to the journeys. **4.3** Commit.

## Task 5: `GoLivePanel` handle

- [ ] **5.1 Failing tests:** `goLiveAuto({ title, neonMode, expect })` goes live with an **empty deck** and **no input device**, sending the given title (not stale state) and `expect`; `loadAndPlay(files, names)` fills the deck, calls `setRepeat(false)` directly and plays; `reconnect()` dispatches the same event as the `online` handler; `endAuto(expectId)` ends with `expect`; `onQueueFinished` fires exactly once after the last track, including inside a crossfade; a file error calls the skip path only when SCHEDULE RUNNER owns the deck; display names reach the now-playing payload; `refreshToken()` updates the cached unload-beacon token.
- [ ] **5.2** Implement with `forwardRef` + `useImperativeHandle` and one `onQueueFinished` callback in the existing end-of-queue branch.
- [ ] **5.3 Diff gate:** `git diff master -- src/radio/admin/GoLivePanel.tsx` may touch only the handle, the queue-finished callback line, the file-error skip branch, the `expect` field passed to the publisher request, the token refresh and the display-name lookup. All existing `GoLivePanel` tests pass unchanged. **5.4** Commit.

## Task 6: `useScheduleRunner` + SCHEDULE RUNNER bar

- [ ] **6.0** The scheduler tick and heartbeat run in a dedicated Web Worker (timers in a hidden page are throttled); the page only executes what the worker asks for. Uses `useServerClock`.
- [ ] **6.1 Failing tests** (fake timers, mocked handle, worker and client): ARM claims the lease with a per-tab id and creates/resumes a test audio context inside the click (3 s timeout, closed afterwards); preflight reads the station row fresh; an armed wake lock uses its own ref and survives END; a second console cannot arm; heartbeat every 60 s; wake lock requested while armed and visible, re-requested on `visibilitychange`; the machine's decisions reach the handle in order; any thrown error is caught and reported (the console never crashes); DISARM releases the lease; page unload releases it best-effort.
- [ ] **6.2** Bar UI on every tab: OFF + ARM, red "next show has files but SCHEDULE RUNNER is off", ARMED line with next show and check age, STARTING / ON AIR / FAILED with reason, DISARM. Inside its own error boundary.
- [ ] **6.3** Commit.

## Task 7: phone status line

- [ ] **7.1 Failing tests:** `LiveRoom` in host mode only (aal2) shows the line; listeners never render it and never query `runner_status`; reads every 60 s, no channel; heartbeat over 3 min old turns amber with "last seen"; failed/missed red.
- [ ] **7.2** Implement. **7.3** Commit.

## Task 8: standby DELAYED

- [x] **8.1 Failing tests** (2026-11-27, 3 in `scheduleRules.test.ts`, 1 in `StandbyScreen.test.tsx`; the old 30-min STARTING SOON test now stops at 9:59): STARTING SOON from T to T+10 min, DELAYED from T+10 to T+30 min, then the next show; copy "The signal is late." (the screen's own "Keep this page open" line stays below)
- [x] **8.2** Implement in `scheduleRules.standbyState` (`SOON_MS`, kind `delayed`); the card turns amber `#FFB52E`, same size as STARTING SOON. **8.3** Commit.

## Task 9: verification, design, docs

- [ ] **9.1** `npm run build`, `npx vitest run`: clean, count above the Release 1 count.
- [ ] **9.2** `design-critic` on the bar, playlist editor and phone line at 320/390/768/1280 and sideways.
- [ ] **9.3** Docs: CLAUDE.md (SCHEDULE RUNNER section: requirements, failure matrix, lease, never rename AUTO), host guide new page (Windows Sleep Never, update active hours, keep window visible, allow automatic downloads, reload disarms), `build_guide.py` + PDF.

## Task 10: rollout and validation (owner + agent, real PC)

All tests use `TEST` shows at hours with no real show within 6 h. **The preview runs on the production database and station row.**

- [ ] **V-A1** ARM, start accuracy over 3 shows each with the window visible, minimised, **screen locked** and **display off** (target: on air within 5 s of T-45 s, deck at T ±2 s). Record all four; the guide's wording follows the result.
- [ ] **V-A2** Overnight: three shows, two separate, one continuous with 5 files. Each starts, plays every file, ends; transcripts saved; restreamer picked each up; neon shows track names.
- [ ] **V-A3** 48 h armed soak: heartbeat continuous, memory stable, sign-in still valid, a show at hour 47 starts.
- [ ] **V-A4** Failure injection: network off at T-1 min (retries, starts when back); console closed mid-show (watchdog ends the station within 5 min; phone amber); console closed before a show (guests DELAYED then next); sleep the PC; expired session (START FAILED: sign-in); a manual show live at T (SCHEDULE RUNNER does not start, the manual show is untouched); an unreadable file in the middle of a set (skipped); Memory Saver on, site not excepted (record what happens).
- [ ] **V-A5** Chrome restart: files still present (persistent storage), console asks for sign-in, bar shows OFF.
- [ ] **V-A6** Mid-show network cut of 40 s: reconnects to the same broadcast, track not restarted, chat kept. Two shows 15 s apart: the restreamer logs an END and a new GO LIVE, not a restart.
- [ ] **V-A7** Phone line correct in all of the above.
- [ ] **V-A8** Merge, `npm run check:api`, bundle hash changed.

## Effort

| Block | Hours |
|---|---|
| Tasks 1-3 (incl. server condition and watchdog) | 18 |
| Tasks 4-5 | 9 |
| Task 6 (incl. worker) | 10 |
| Tasks 7-8 | 3 |
| Task 9 | 5 |
| Task 10 (agent side) | 2 |
| **Total** | **about 47 h, 5-6 sessions**, plus owner time for V-A1 to V-A7 (two evenings and a weekend soak) |

## Self-review
- [x] Effect on audio and crowd size stated first in the spec.
- [x] Only existing handlers drive audio; `GoLivePanel` fenced by a diff gate; the one server change is optional and regression-locked.
- [x] No failure can leave the station live with nobody there for more than 5 minutes (watchdog), and SCHEDULE RUNNER can never take over or end a show it did not start.
- [x] Every failure in the matrix has a test or a validation step.
- [x] Lease and status readable only by the host with 2FA; probes proven able to fail.
- [x] Browser behaviours that cannot be unit-tested are validated on the owner's PC.
