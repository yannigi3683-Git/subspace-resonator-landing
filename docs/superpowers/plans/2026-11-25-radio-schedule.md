# Radio SCHEDULE: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:test-driven-development` (write the failing test first, every task), then `superpowers:executing-plans` to work task by task. Steps use checkbox (`- [ ]`) syntax. **Do not start until the owner has signed off the journeys** (`docs/superpowers/mockups/2026-11-25-schedule-journeys/`).

**Goal:** A SCHEDULE tab where the host lists upcoming shows, a standby countdown that off-air guests see before the gate, and a BROADCAST TITLE pre-filled from the schedule.

**Spec:** `docs/superpowers/specs/2026-11-25-radio-schedule-design.md` (decisions D1-D4, red-team cycles 1-12, including the independent red team in cycle 10).

**Architecture:** One schema delta (grants + `upcoming_shows` read function + index). Pure rules in `src/radio/scheduleRules.ts`. Host: `useSchedule` hook in `AdminConsole`, `SchedulePanel` behind a local error boundary, and one optional `suggestedTitle` prop into `GoLivePanel`. Guest: `StandbyScreen` rewritten around the rules; `ListenerApp` renders it instead of the gate while off air.

**Tech stack:** React 19, TypeScript 6 strict, Tailwind v3, lucide-react, supabase-js, Vitest. No new dependencies.

**Branch:** `feat/radio-schedule` off `master` (`git switch master && git pull --ff-only && git switch -c feat/radio-schedule`).

**Baseline (measured 2026-11-25 on `master`):** 67 test files, 587 tests. Expected after: about 72 files, about 640 tests.

**Never touched:** `src/radio/rtc/*`, `restreamer/*`, `api/*`, `useListenerAudio.ts`, `useListenerTransport.ts`, and every `GoLivePanel` line outside the title field.

---

## File map

| File | Change |
|---|---|
| `supabase/radio-schema.sql` | Grants, `upcoming_shows`, index, policy clean-up |
| `scripts/rls-probe.mjs` | New supabase-js harness for the `scheduled_shows` probes (fixture row, no-session and anon-session clients) |
| `docs/superpowers/plans/2026-11-25-radio-schedule-delta.sql` | The delta, as one block for the owner to paste |
| `src/radio/scheduleRules.ts` + `.test.ts` | New, pure |
| `src/radio/hooks/useSchedule.ts` + `.test.ts` | New |
| `src/radio/admin/SchedulePanel.tsx` + `.test.tsx` | New |
| `src/radio/admin/AdminConsole.tsx` + `.test.tsx` | Mount hook, panel, boundary, pass `suggestedTitle` |
| `src/radio/admin/GoLivePanel.tsx` + `.test.tsx` | Title pre-fill only |
| `src/radio/components/StandbyScreen.tsx` + `.test.tsx` | Rewrite around the rules |
| `src/radio/RadioApp.tsx` + test | Standby before the gate |
| `src/radio/radio.css` | Pulse into the reduced-motion list |
| `CLAUDE.md`, `restreamer/guide/build_guide.py` (+ PDF), `docs/RADIO-BETA-TEST-AND-LAUNCH-GUIDE.md` | Docs |

---

## Phase 0: owner audit (blocks Phase 1)

- [ ] **0.1** Owner runs in the Supabase SQL editor and pastes the output:
  1. `pg_policies` for `scheduled_shows` (policy name, cmd, permissive, qual, with_check)
  2. `information_schema.role_table_grants` for `scheduled_shows`
  3. row count of `scheduled_shows`
- [ ] **0.2** Pass condition: only `shows_read` (select) and `shows_write` (admin + aal2). **Any other policy** on the table is recorded and dropped in Task 1, bare `true` or not.

## Task 1: schema delta

- [ ] **1.1 The test already exists.** `supabase/grants.test.ts` fails by itself whenever `.insert/.update/.delete` on `scheduled_shows` appear in `src/` without a matching grant. Task 3.3 proves it guards these writes.
- [x] **1.2** Add to `radio-schema.sql` (section 2 and section 10): the `aired_at timestamptz` column, the three grants, `upcoming_shows(_limit)` (sql, stable, security invoker, `set search_path = public`, limit clamped to 10, 30 min grace using `now()`), its execute grant to anon and authenticated, the `starts_at` index, and explicit drops for any policy found in 0.2.
- [x] **1.3** Write the same statements to `docs/superpowers/plans/2026-11-25-radio-schedule-delta.sql` (outside `supabase/`, so `grants.test.ts` does not read it twice), for the owner to paste **off air** in 10.1.
- [x] **1.4 (done 2026-11-26, after PR #57 merged; master merged into this branch) Extend the rebuilt probe for the schedule:** `upcoming_shows` callable with no session and as a listener (`rpcAnswers`, tested); the existing schedule insert/update/delete checks already cover the new grants. **The `upcoming_shows(1000)` clamp check was dropped:** `shows_read` is `using (true)` and anon holds SELECT, so a guest can read the whole table directly; the clamp is a tidiness limit, not a security boundary, and proving it needs 11 future-dated fixture shows that real guests would see on `/radio` during the run. Original wording kept below for the record.
- [ ] ~~1.4 Rebuild the `scheduled_shows` probes so they can fail~~ (the current probe sends a key that always gets 401 and counts that as PASS). In `scripts/rls-probe.mjs`, on supabase-js:
  - a client with **no session** and a client **signed in anonymously** (costs one anon sign-in per run);
  - a fixture show created with the service key, dated in the past so it never reaches standby, deleted in `finally`;
  - each client tries insert, update and delete; PASS only if the insert errors **and** the fixture row is unchanged after the update and still present after the delete (re-read with the service key);
  - `upcoming_shows` called by both clients succeeds; `upcoming_shows(1000)` returns at most 10;
  - **prove the probe can fail:** a `--selftest` flag runs the same write checks with the service-role client, which bypasses RLS, so the writes succeed and every check must print FAIL. Record that output in the PR.
  - The older probes (bans, chat insert) have the same flaw. **Not fixed here**; offered to the owner as a separate task.
- [ ] **1.5** Commit: `feat(radio): schedule schema delta (grants, upcoming_shows)`.

## Task 2: `scheduleRules.ts` (pure)

- [x] **2.1 Failing tests** in `src/radio/scheduleRules.test.ts`:
  - `formatCountdown`: 0 and negative; 59 s; 1 h; 23:59:59; 1 day; 5d 03:22:08; 40 days.
  - `standbyState`: aired shows are ignored; no shows gives `tba`; read error gives `unavailable`; future show gives `countdown` with `later` capped at 2; at start and at start + 29:59 gives `starting-soon`; at start + 30:00 moves to the next show; late show plus a later one shows both.
  - `suggestTitle`: none outside the window; picks the earliest inside `[now - 30 min, now + 6 h]`; two same-day shows pick the first, then the second once the first is over 30 min past.
  - `validateShow`: empty and whitespace title rejected; 81 chars rejected; 80 accepted after trim; invalid date rejected; past start warns, does not block; another show within 60 min warns with its title and the gap.
  - `formatShowTime`: Asia/Jerusalem en-GB gives `Sun 29 Nov, 22:00 GMT+2`; America/New_York en-US gives the EST form; a DST-change date in both zones.
  - `hostTimePreview`: device in Israel gives no note; device in Asia/Kolkata gives the note and still shows Israel and UTC.
- [x] **2.2** Run `npx vitest run src/radio/scheduleRules.test.ts`, confirm red.
- [x] **2.2b** Add totality tests: invalid ISO strings, `NaN` dates, empty arrays, empty and whitespace titles, unknown time zones. **No function may throw**; each returns a safe value (no suggestion, `tba`, `--:--`).
- [x] **2.3** Implement. Confirm green.
- [x] **2.4** Commit: `feat(radio): schedule rules`.

## Task 3: `useSchedule` hook

- [x] **3.1 Failing tests** with a mocked supabase client and fake timers: reads on mount; re-reads after 60 s while visible; skips while hidden; re-reads on `visibilitychange`; a failed read keeps the previous list and sets `error`; `add` disables re-entry while pending; `update` and `remove` report an error when the response has **zero rows**; every write triggers a re-read.
- [x] **3.2** Implement in `src/radio/hooks/useSchedule.ts`. Reads the **table directly** (all upcoming plus the last 5 past), never the RPC, so no show is ever hidden from the host. Selects on the passed client only, **no channels**, so the existing "AdminConsole never opens a channel on the shared client" test keeps passing. Every read and write error is caught and returned as `error`; the hook never throws.
- [x] **3.3** Guard check (not committed): comment out the Task 1 write grants, run `npx vitest run supabase/grants.test.ts`, confirm red; restore, confirm green.
- [x] **3.4** Commit: `feat(radio): useSchedule hook`.

## Task 4: `SchedulePanel`

- [x] **4.1 Failing tests** in `src/radio/admin/SchedulePanel.test.tsx`:
  - Renders upcoming rows soonest first with Israel and UTC times; PAST folded with a count.
  - ADD disabled until the title and time are valid; preview text appears; overlap and past warnings appear and do not disable ADD; ADD disabled while saving.
  - EDIT opens one row inline; opening another closes the first; SAVE calls update; CANCEL restores.
  - DELETE first tap shows the confirm row; KEEP cancels; second DELETE calls remove.
  - Zero-row error and insert error render in a `role="alert"` box.
  - Every button is at least 44 px (class check, as elsewhere in the radio tests).
  - No em dash in rendered copy.
- [x] **4.2** Implement. Match the journeys' layout and copy exactly.
- [x] **4.3** Commit: `feat(radio): SCHEDULE panel`.
  - Added on the way: `formatRelative`, `wallTimeToMs`, `msToWallTime` in `scheduleRules.ts` (typed times read against an explicit device zone, so results never depend on where the code runs), and a test that the edit field keeps the cursor while typing (it did not at first: rows were a component declared inside the panel).

## Task 5: `AdminConsole` wiring + error boundary

- [x] **5.0** (Done differently: the console tests mock `useSchedule` and `useServerClock` the same way they already mock `GoLivePanel`, so the prop client needs no `from`/`rpc`.) Extend the test mock `makeProp()` (`AdminConsole.test.tsx:51`) with `from` and `rpc`, since the console-level hook now reads on mount.
- [x] **5.1 Failing tests** in `AdminConsole.test.tsx`:
  - SCHEDULE tab shows the panel (replaces "coming in M8").
  - **A panel that throws on render leaves `GoLivePanel` mounted and its GO LIVE button present**, and shows "Schedule failed to load."
  - `suggestedTitle` reaches `GoLivePanel` from the hook. **Moved to Task 6**, which adds that prop to `GoLivePanel`.
  - A schedule read that rejects leaves the console and `GoLivePanel` working, with no suggestion.
  - When the broadcast status becomes live, the show starting within `[now - 30 min, now + 60 min]` is marked aired once; a failed write is logged and nothing else changes; no show is marked for a broadcast outside that window.
  - Existing assertion still holds: no channel opened on the shared prop client.
- [x] **5.2** Implement: hook at the console level (so pre-fill works without opening the tab), boundary around the panel only.
- [x] **5.3** Commit: `feat(radio): wire SCHEDULE tab into the console`.

## Task 6: `GoLivePanel` title pre-fill (D4)

- [x] **6.1 Failing tests** in `GoLivePanel.test.tsx`:
  - Idle, empty field: suggestion fills it and the hint `From schedule: ...` shows.
  - Host typed something: suggestion ignored.
  - **Host clears the field (to get LIVE DJ): it stays empty** when the next suggestion arrives.
  - Field still holds the last pre-fill and the suggestion changes: field follows.
  - Station row still loading (`null`, the mock's default at `GoLivePanel.test.tsx:13`): suggestion ignored until the row is known.
  - Status `starting`, `live`, `ending` or `error`: suggestion ignored.
  - **Lost state: a new suggestion never changes the title, and the next GO LIVE sends the original title.**
  - Station row live while the panel is idle (second console): suggestion ignored.
  - After END BROADCAST returns to idle: `hostEdited` resets, and the next suggestion applies to an empty or still-pre-filled field.
  - The hint renders only while the field holds the pre-fill.
- [x] **6.2** Implement with the minimum lines: one prop, one "pre-filled value" ref, one `hostEdited` ref, one effect, one hint line.
- [x] **6.3 Review gate:** `git diff master -- src/radio/admin/GoLivePanel.tsx` must touch only the prop, those refs, that effect, the title input's change handler, the END handler's one-line `hostEdited` reset and the hint. Anything else fails the task.
- [x] **6.4** Commit: `feat(radio): pre-fill broadcast title from the schedule`.
  - Gate result 2026-11-25: 20 lines added, 2 changed in `GoLivePanel.tsx`, all pre-fill (prop, two refs, one effect, the title onChange, one reset after END, the hint). `suggestedTitle` is `{ title, when }`, built by `AdminConsole` with the Israel time, so the panel formats nothing.

## Task 7: `StandbyScreen`

- [x] **7.1 Failing tests** (fake timers, mocked RPC, injected server clock):
  - Countdown renders with days; ticks; switches to STARTING SOON at zero with `STANDING BY`; moves on after 30 min.
  - LATER shows at most 2.
  - TBA only when the read succeeded with no shows; a failed read renders no card.
  - Re-reads every 60 s while visible and on `visibilitychange`.
  - Uses the server clock, not `Date.now()` (clock offset test).
  - Ticking digits carry no `aria-live`; the state line does.
  - Copy: "Keep this page open. It switches over by itself when the signal goes live."; no em dash.
- [x] **7.2** Implement to the journeys' layout (nebula backdrop, `min-h-[100dvh]`, short-screen variant, contrast values from the design review).
- [x] **7.3** Add any pulse class to the `prefers-reduced-motion` list in `radio.css`.
- [x] **7.4** Commit: `feat(radio): standby countdown rewrite`.

## Task 8: standby before the gate (D1)

- [ ] **8.0 (moved to V6 / Task 10.5: this container has no Supabase keys, so the no-session check runs on the preview with a private window, timing the switch to the entry screen; a flip slower than 60 s means the Realtime UPDATE is not reaching no-session visitors and only the 60 s re-read is) Prove no-session reads first** (a Node script in the scratchpad, not committed): a supabase-js client with **no session** can select `station`, call `get_server_time` and `upcoming_shows`, subscribe to `station` UPDATEs and receive one when the owner toggles a harmless field off air (or the agent sees the 60 s re-read path work if the Realtime UPDATE never arrives). If the UPDATE does not arrive, record it: the flip then relies on the 60 s re-read and the spec's 5 s target changes to 60 s.
- [x] **8.1 Failing tests** through `RadioApp` with `makeSupabase` mocked (`ListenerApp` is not exported; `RadioApp.test.tsx` is new):
  - No session, station off: standby renders and **`signInAnonymously` is never called**.
  - No session, station loading: LOADING, then the gate after 3 s if still unknown.
  - Station flips live: the gate renders.
  - Station flips off while on the gate: standby renders.
  - Banned in localStorage: SIGNAL BLOCKED, never standby.
  - Session + identity + off air: standby via the existing room path (unchanged).
- [x] **8.2** Implement as a render-time rule (gate + off air renders standby). The only new effect is the 3 s timer for the LOADING fallback; nothing changes on the session/mount path.
- [x] **8.3** Commit: `feat(radio): show the countdown before the gate while off air`.

## Task 9: verification, design review, docs

- [x] **9.1** `npm run build` and `npx vitest run`: both clean; count above baseline.
- [x] **9.2** `design-critic` agent on every new screen at 320, 390, 768, 1280 wide and 844x390 sideways, host and guest. Fix, re-run until no rule breaks.
- [x] **9.3** Docs: CLAUDE.md (Subspace Radio section: schedule, pre-gate standby, title pre-fill incl. PEEK vs ALWAYS, preview-uses-production and test-broadcast warnings, the probe rebuild; correct the test-count line and the `grants.test.ts` line, which also covers `.update` and never checks `.rpc` execute grants), `build_guide.py` + regenerated PDF (host guide page for SCHEDULE), beta guide line for the SCHEDULE tab, Key specs list.
- [x] **9.4** Commit: `docs(radio): schedule`.
  - Design reviews 2026-11-25: SCHEDULE tab (5 sizes, 6 states) and standby (5 sizes, 4 states + New York + reduced motion) on a local harness, never committed. Fixed: '1h 60m' rounding, focus after edit/delete, past-row contrast, off-screen alert, long titles, a failed refresh blanking a good countdown, the empty failed-load screen, LATER read as one block. Not done: input borders (project-wide token). The standby padlock is Release 2 (phone status line).

## Task 10: rollout and validation (owner + agent)

- [ ] **10.1** Owner pastes `2026-11-25-radio-schedule-delta.sql` into the SQL editor **off air**; agent runs `node scripts/rls-probe.mjs`: all schedule probes PASS, and the fixture row is gone afterwards.
- [ ] **10.2** PR from `feat/radio-schedule`. Vercel preview. **The preview uses the production database and the production station row.** Shows: only real ones, or `TEST` titles deleted straight after. **Test broadcasts: never within 6 hours of an announced show, title typed as `TEST`**, because GO LIVE pulls every real guest waiting on the standby screen to the gate.
- [ ] **10.3** V3: add, edit, delete on desktop and phone; force a refused change by signing out in another tab and confirm the red message.
- [ ] **10.4** V5: second phone set to New York shows the same countdown and New York times.
- [ ] **10.5** V6: private window, no session: countdown shows with no name prompt; host GO LIVE flips it to the gate. Time the flip (target under 5 s).
- [ ] **10.6** V4: private test broadcast, listener phone on `/radio?debug`: edit the schedule more than 1 h after GO LIVE; audio uninterrupted; END BROADCAST works.
- [ ] **10.7** D4 check, using a `TEST` show scheduled when no real show is near: open the console: title pre-filled; type over it, it stays; clear it, it stays empty.
- [ ] **10.8** Merge (owner). Post-deploy: `npm run check:api` prints `API ALIVE`; radio bundle hash changed; sitemap untouched.

---

## Effort

| Block | Hours |
|---|---|
| Tasks 1-2 (incl. probe rebuild) | 6 |
| Tasks 3-5 | 7 |
| Task 6 | 2 |
| Tasks 7-8 | 5 |
| Task 9 | 3 |
| Task 10 (agent side) | 1 |
| **Total** | **about 24 h, 3 sessions**, plus about 1.5 h owner testing |

## Self-review checklist
- [x] Every task starts with a failing test and names the file.
- [x] Effect on audio and crowd size stated first in the spec.
- [x] Frozen audio path and restreamer untouched; `GoLivePanel` change fenced by a diff gate.
- [x] Grants guarded by the existing `grants.test.ts`; RLS by a rebuilt `rls-probe.mjs` that has been shown to fail.
- [x] New code outside the error boundary cannot throw (total functions, caught reads).
- [x] Error state never shown as an empty state.
- [x] Copy has no em dashes; 44 px targets; 10 px text floor; no custom Tailwind `screens`.
- [x] Preview-uses-production risk written into the validation steps.
- [x] Docs updated in the same branch.
