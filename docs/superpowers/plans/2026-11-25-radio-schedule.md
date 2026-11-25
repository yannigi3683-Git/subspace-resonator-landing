# Radio SCHEDULE: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:test-driven-development` (write the failing test first, every task), then `superpowers:executing-plans` to work task by task. Steps use checkbox (`- [ ]`) syntax. **Do not start until the owner has signed off the journeys** (`docs/superpowers/mockups/2026-11-25-schedule-journeys/`).

**Goal:** A SCHEDULE tab where the host lists upcoming shows, a standby countdown that off-air guests see before the gate, and a BROADCAST TITLE pre-filled from the schedule.

**Spec:** `docs/superpowers/specs/2026-11-25-radio-schedule-design.md` (decisions D1-D4, red-team cycles 1-9).

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
| `scripts/rls-probe.mjs` | Update/delete/RPC probes |
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
- [ ] **0.2** Pass condition: only `shows_read` (select) and `shows_write` (admin + aal2). Any extra PERMISSIVE policy with a bare `true` is recorded and dropped in Task 1.

## Task 1: schema delta

- [ ] **1.1 The test already exists.** `supabase/grants.test.ts` fails by itself whenever `.insert/.update/.delete` on `scheduled_shows` appear in `src/` without a matching grant. Task 3.3 proves it guards these writes.
- [ ] **1.2** Add to `radio-schema.sql` (section 2 and section 10): the three grants, `upcoming_shows` (sql, stable, security invoker, limit clamped to 10, 30 min grace using `now()`), its execute grant to anon and authenticated, the `starts_at` index, and explicit drops for any policy found in 0.2.
- [ ] **1.3** Put the same statements into a standalone delta block in the PR description, for the owner to apply **off air**.
- [ ] **1.4** Extend `scripts/rls-probe.mjs`: anon cannot update or delete a show; an anonymous-signed-in listener cannot insert, update or delete; anon can call `upcoming_shows`; `upcoming_shows(1000)` returns at most 10.
- [ ] **1.5** Commit: `feat(radio): schedule schema delta (grants, upcoming_shows)`.

## Task 2: `scheduleRules.ts` (pure)

- [ ] **2.1 Failing tests** in `src/radio/scheduleRules.test.ts`:
  - `formatCountdown`: 0 and negative; 59 s; 1 h; 23:59:59; 1 day; 5d 03:22:08; 40 days.
  - `standbyState`: no shows gives `tba`; read error gives `unavailable`; future show gives `countdown` with `later` capped at 2; at start and at start + 29:59 gives `starting-soon`; at start + 30:00 moves to the next show; late show plus a later one shows both.
  - `suggestTitle`: none outside the window; picks the earliest inside `[now - 30 min, now + 6 h]`; two same-day shows pick the first, then the second once the first is over 30 min past.
  - `validateShow`: empty and whitespace title rejected; 81 chars rejected; 80 accepted after trim; invalid date rejected; past start warns, does not block; another show within 60 min warns with its title and the gap.
  - `formatShowTime`: Asia/Jerusalem en-GB gives `Sun 29 Nov, 22:00 GMT+2`; America/New_York en-US gives the EST form; a DST-change date in both zones.
  - `hostTimePreview`: device in Israel gives no note; device in Asia/Kolkata gives the note and still shows Israel and UTC.
- [ ] **2.2** Run `npx vitest run src/radio/scheduleRules.test.ts`, confirm red.
- [ ] **2.3** Implement. Confirm green.
- [ ] **2.4** Commit: `feat(radio): schedule rules`.

## Task 3: `useSchedule` hook

- [ ] **3.1 Failing tests** with a mocked supabase client and fake timers: reads on mount; re-reads after 60 s while visible; skips while hidden; re-reads on `visibilitychange`; a failed read keeps the previous list and sets `error`; `add` disables re-entry while pending; `update` and `remove` report an error when the response has **zero rows**; every write triggers a re-read.
- [ ] **3.2** Implement in `src/radio/hooks/useSchedule.ts` (selects on the passed client only; **no channels**, so the existing "AdminConsole never opens a channel on the shared client" test keeps passing).
- [ ] **3.3** Guard check (not committed): comment out the Task 1 write grants, run `npx vitest run supabase/grants.test.ts`, confirm red; restore, confirm green.
- [ ] **3.4** Commit: `feat(radio): useSchedule hook`.

## Task 4: `SchedulePanel`

- [ ] **4.1 Failing tests** in `src/radio/admin/SchedulePanel.test.tsx`:
  - Renders upcoming rows soonest first with Israel and UTC times; PAST folded with a count.
  - ADD disabled until the title and time are valid; preview text appears; overlap and past warnings appear and do not disable ADD; ADD disabled while saving.
  - EDIT opens one row inline; opening another closes the first; SAVE calls update; CANCEL restores.
  - DELETE first tap shows the confirm row; KEEP cancels; second DELETE calls remove.
  - Zero-row error and insert error render in a `role="alert"` box.
  - Every button is at least 44 px (class check, as elsewhere in the radio tests).
  - No em dash in rendered copy.
- [ ] **4.2** Implement. Match the journeys' layout and copy exactly.
- [ ] **4.3** Commit: `feat(radio): SCHEDULE panel`.

## Task 5: `AdminConsole` wiring + error boundary

- [ ] **5.1 Failing tests** in `AdminConsole.test.tsx`:
  - SCHEDULE tab shows the panel (replaces "coming in M8").
  - **A panel that throws on render leaves `GoLivePanel` mounted and its GO LIVE button present**, and shows "Schedule failed to load."
  - `suggestedTitle` reaches `GoLivePanel` from the hook.
  - Existing assertion still holds: no channel opened on the shared prop client.
- [ ] **5.2** Implement: hook at the console level (so pre-fill works without opening the tab), boundary around the panel only.
- [ ] **5.3** Commit: `feat(radio): wire SCHEDULE tab into the console`.

## Task 6: `GoLivePanel` title pre-fill (D4)

- [ ] **6.1 Failing tests** in `GoLivePanel.test.tsx`:
  - Idle, empty field: suggestion fills it and the hint `From schedule: ...` shows.
  - Host typed something: suggestion ignored.
  - Field still holds the last pre-fill and the suggestion changes: field follows.
  - Status `starting`, `live`, `ending` or `error`: suggestion ignored.
  - **Lost state: a new suggestion never changes the title, and the next GO LIVE sends the original title.**
  - Station row live while the panel is idle (second console): suggestion ignored.
  - After END BROADCAST returns to idle with a pre-filled title: next suggestion applies.
- [ ] **6.2** Implement with the minimum lines: one prop, one "pre-filled value" ref, one effect, one hint line.
- [ ] **6.3 Review gate:** `git diff master -- src/radio/admin/GoLivePanel.tsx` must touch only the prop, that ref, that effect, the title input's change handler and the hint. Anything else fails the task.
- [ ] **6.4** Commit: `feat(radio): pre-fill broadcast title from the schedule`.

## Task 7: `StandbyScreen`

- [ ] **7.1 Failing tests** (fake timers, mocked RPC, injected server clock):
  - Countdown renders with days; ticks; switches to STARTING SOON at zero with `STANDING BY`; moves on after 30 min.
  - LATER shows at most 2.
  - TBA only when the read succeeded with no shows; a failed read renders no card.
  - Re-reads every 60 s while visible and on `visibilitychange`.
  - Uses the server clock, not `Date.now()` (clock offset test).
  - Ticking digits carry no `aria-live`; the state line does.
  - Copy: "Keep this page open. It switches over by itself when the signal goes live."; no em dash.
- [ ] **7.2** Implement to the journeys' layout (nebula backdrop, `min-h-[100dvh]`, short-screen variant, contrast values from the design review).
- [ ] **7.3** Add any pulse class to the `prefers-reduced-motion` list in `radio.css`.
- [ ] **7.4** Commit: `feat(radio): standby countdown rewrite`.

## Task 8: standby before the gate (D1)

- [ ] **8.1 Failing tests** for `ListenerApp` (new `RadioApp.test.tsx` if none exists):
  - No session, station off: standby renders and **`signInAnonymously` is never called**.
  - No session, station loading: LOADING, then the gate after 3 s if still unknown.
  - Station flips live: the gate renders.
  - Station flips off while on the gate: standby renders.
  - Banned in localStorage: SIGNAL BLOCKED, never standby.
  - Session + identity + off air: standby via the existing room path (unchanged).
- [ ] **8.2** Implement as a render-time rule; no new effect on the mount path.
- [ ] **8.3** Commit: `feat(radio): show the countdown before the gate while off air`.

## Task 9: verification, design review, docs

- [ ] **9.1** `npm run build` and `npx vitest run`: both clean; count above baseline.
- [ ] **9.2** `design-critic` agent on every new screen at 320, 390, 768, 1280 wide and 844x390 sideways, host and guest. Fix, re-run until no rule breaks.
- [ ] **9.3** Docs: CLAUDE.md (Subspace Radio section: schedule, pre-gate standby, title pre-fill, preview-uses-production warning; correct the test-count line), `build_guide.py` + regenerated PDF (host guide page for SCHEDULE), beta guide line for the SCHEDULE tab, Key specs list.
- [ ] **9.4** Commit: `docs(radio): schedule`.

## Task 10: rollout and validation (owner + agent)

- [ ] **10.1** Owner applies the delta **off air**; agent runs `node scripts/rls-probe.mjs`: all PASS.
- [ ] **10.2** PR from `feat/radio-schedule`. Vercel preview. **Reminder: the preview uses the production database.** Only real shows, or `TEST` titles deleted straight after.
- [ ] **10.3** V3: add, edit, delete on desktop and phone; force a refused change by signing out in another tab and confirm the red message.
- [ ] **10.4** V5: second phone set to New York shows the same countdown and New York times.
- [ ] **10.5** V6: private window, no session: countdown shows with no name prompt; host GO LIVE flips it to the gate. Time the flip (target under 5 s).
- [ ] **10.6** V4: private test broadcast, listener phone on `/radio?debug`: edit the schedule more than 1 h after GO LIVE; audio uninterrupted; END BROADCAST works.
- [ ] **10.7** D4 check: with a show in the next 6 h, open the console: title pre-filled; type over it; it stays.
- [ ] **10.8** Merge (owner). Post-deploy: `npm run check:api` prints `API ALIVE`; radio bundle hash changed; sitemap untouched.

---

## Effort

| Block | Hours |
|---|---|
| Tasks 1-2 | 4 |
| Tasks 3-5 | 7 |
| Task 6 | 2 |
| Tasks 7-8 | 5 |
| Task 9 | 3 |
| Task 10 (agent side) | 1 |
| **Total** | **about 22 h, 3 sessions**, plus about 1.5 h owner testing |

## Self-review checklist
- [x] Every task starts with a failing test and names the file.
- [x] Effect on audio and crowd size stated first in the spec.
- [x] Frozen audio path and restreamer untouched; `GoLivePanel` change fenced by a diff gate.
- [x] Grants guarded by the existing `grants.test.ts`; RLS by `rls-probe.mjs`.
- [x] Error state never shown as an empty state.
- [x] Copy has no em dashes; 44 px targets; 10 px text floor; no custom Tailwind `screens`.
- [x] Preview-uses-production risk written into the validation steps.
- [x] Docs updated in the same branch.
