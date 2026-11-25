# Radio SCHEDULE - Design Spec

Status: **red-teamed (9 own cycles + 1 independent red team + 2 design reviews), ready for owner review of the journeys. No code written.**
Date: 2026-11-25. Supersedes the design sections of `plans/2026-11-24-host-schedule-plan.md`,
which stays as the approval history (owner answers in its sections 8-9).
Implementation plan: `plans/2026-11-25-radio-schedule.md`.
Journeys (clickable prototypes): `mockups/2026-11-25-schedule-journeys/`.

---

## 1. Effect on broadcast quality and crowd size

| Concern | Effect |
|---|---|
| Broadcast audio / stability | **None.** No change to `src/radio/rtc/*`, the restreamer, or `api/rtc-session.ts`. `GoLivePanel.tsx` changes in **one place only**: the BROADCAST TITLE field can be pre-filled while off air (D4). Its transport, mixer, publisher and crossfade lines are not touched, and the plan enforces that with a diff check. |
| Realtime clients (200 cap) | **None added per visitor.** Guests already hold one Realtime client on the entry gate today; the pre-gate standby holds the same one. But "Keep this page open" means more people stay connected in the minutes before GO LIVE (background tabs included), and every one of them counts toward the 200. Same ceiling as today, reached a little earlier on a busy night. |
| Presence events (20/s cap) | **None.** |
| Anon sign-ins (300/h per IP) | **Lower.** Off-air visitors no longer sign in just to see the countdown (D1). |
| DB load | Two selects per standby guest per minute while off air (the existing station re-read plus the schedule); one per minute from the host console. Negligible. |

## 2. Owner decisions (2026-11-25)

| ID | Decision |
|---|---|
| D1 | **Yes.** Off-air visitors see the countdown before the name/avatar gate. |
| D2 | **Yes.** Next show big, up to 2 more under LATER. |
| D3 | **Yes.** STARTING SOON for 30 minutes after the start time, then move on. |
| D4 | **Yes.** BROADCAST TITLE is pre-filled from the scheduled show. |
| Scope | **Schedule only.** No automatic playout (future autopilot recorded in the 2026-11-24 plan, section 9). |

## 3. What the feature is

An announcement board, not an automation. The host lists upcoming shows in a new SCHEDULE
tab; guests who open `/radio` while off air see a countdown to the next one; when the host is
about to go live, the title field is already filled in. The host still presses GO LIVE.

## 4. Design

### 4.1 Data (`supabase/radio-schema.sql`, applied as a delta, never while on air)
- Existing table `scheduled_shows (id, title 1-80, starts_at, created_at)`. No new columns.
- Add table grants `insert, update, delete` to `authenticated`. RLS (`shows_write`, admin + aal2) remains the real gate.
- New read function `upcoming_shows(_limit)` (`_limit`, since `limit` is reserved; `set search_path = public`): security invoker (RLS applies), returns `id, title, starts_at` for shows with `starts_at > now() - 30 min`, soonest first, limit clamped to 10. Execute granted to anon and authenticated. The **server clock** decides what is upcoming.
- Index on `starts_at`.
- Any policy on `scheduled_shows` other than `shows_read` and `shows_write` found by the Phase 0 audit is dropped explicitly, in the existing style (not only bare-`true` ones: the 2026-07 `station_admin_write` hole was not a bare `true`).
- **The host console reads the table directly** (all upcoming + last 5 past); only guests use `upcoming_shows`, so its clamp of 10 can never hide a show from the host or from the clash check.

### 4.2 Pure rules (`src/radio/scheduleRules.ts`)
- `validateShow(input, now, others)`: title 1-80 after trim; valid date; **warnings** (never blocks): start in the past, another show within 60 min.
- `standbyState(shows, serverNow)`: `countdown` / `starting-soon` (start <= now < start + 30 min) / `tba` / `unavailable` (read failed). Returns `next` and up to 2 `later`.
- `suggestTitle(shows, serverNow)`: the earliest show with start in `[now - 30 min, now + 6 h]`, else none.
- `formatCountdown(ms)`: `5d 03:22:08`, `03:22:08`, `22:08`.
- `formatShowTime(iso, timeZone, locale)`: `Intl.DateTimeFormat`, explicit zone and locale, so tests never depend on the machine.
- `hostTimePreview(iso, deviceZone)`: device zone line + Israel line + UTC line; flags when the device zone is not `Asia/Jerusalem`. The device zone is labelled with what `Intl` returns (e.g. `GMT+5:30`), never an invented city name.
- **Every rule function is total:** a bad date, an empty list or an empty title returns a safe value, never throws. Tested with bad input. This matters because `suggestTitle` and the pre-fill hint run outside the Schedule error boundary, next to `GoLivePanel`.

### 4.3 Host: `useSchedule` + `SchedulePanel` + title pre-fill
- `useSchedule` (in `AdminConsole`): reads upcoming + last 5 past shows on mount, every 60 s while visible, on `visibilitychange`, and after every write. Never throws; failure leaves the last good list and sets an error string.
- `SchedulePanel`, inside a **local error boundary**, rendered only on the SCHEDULE tab. `GoLivePanel` stays mounted and hidden exactly as today.
  - NEW SHOW: title, `datetime-local` start, preview (device zone, Israel, UTC, "in 12 days"), warnings, ADD (disabled while saving, so a double tap cannot insert twice).
  - UPCOMING list: date block, title (wraps to 2 lines), Israel + UTC times, relative time, EDIT and DELETE.
  - EDIT opens inline (one row at a time; opening another closes the first). SAVE / CANCEL.
  - DELETE needs two taps: DELETE then a confirm row with DELETE / KEEP.
  - PAST (n) folded; past shows can be deleted, not edited.
  - Every update and delete asks for the changed rows back; **zero rows is an error**, shown in red. Insert errors shown in red. Nothing fails silently.
- D4 pre-fill, in `GoLivePanel` via a new optional prop `suggestedTitle`:
  - Applies only while `status === 'idle'` **and** the station row is not live.
  - Applies only while the host has **not edited the field** (a `hostEdited` flag): the field is empty or still holds the last pre-filled value. Any keystroke, **including clearing the field to get `LIVE DJ`**, sets `hostEdited` and the field is left alone. END BROADCAST resets `hostEdited`, so the next show can pre-fill an empty or still-pre-filled field.
  - Never touches `titleRef` (which is set only at GO LIVE), so a reconnect can never re-title a running show.
  - Shows a hint under the field only while the field holds the pre-fill: `From schedule: <title> · <time> Israel`.

### 4.4 Guest: standby + pre-gate (D1)
- `ListenerApp`: when the view would be `gate` and the station is **off air**, render `StandbyScreen` instead. While the station row is still loading, show LOADING for up to 3 s, then fall back to the gate (today's behaviour). When the station goes live the gate appears by itself (the existing Realtime subscription in `useStation`, with its 60 s re-read as the fallback). Banned and kicked screens keep priority. Returning visitors with a session reach the same `StandbyScreen` through the existing room path.
- `StandbyScreen`: reads `upcoming_shows(3)` on mount, every 60 s while visible and on `visibilitychange`; ticks against `getServerTime()`; status line `SIGNAL OFFLINE` or `STANDING BY`; countdown card or STARTING SOON card or TBA; LATER list; "Keep this page open. It switches over by itself when the signal goes live."; archive link; footer. If the read fails, the card is omitted (never a false TBA).
- Accessibility: no `aria-live` on the ticking digits; the state line announces changes. Any pulse joins the existing `prefers-reduced-motion` list.
- Layout: scrolls on short screens (`min-h-[100dvh]`, no `overflow-hidden`), compact spacing under 501 px tall via the arbitrary media variant (never a custom `screens` entry), title matches the gate's `sm:text-3xl`.

### 4.5 What guests see in the room
Unchanged code, but D4 changes what is shown: in the default PEEK now-playing mode the neon line under the DJ
shows the **broadcast title** most of the time and peeks the track name for 15 s each minute
(`NowPlaying.tsx`). In ALWAYS mode the track name wins whenever one is known. A
title equal to `Subspace Radio Live` reads `LIVE DJ`.

## 5. Out of scope
Automatic playout, landing-page listing, `.ics` export, recurring shows, notifications, the
console MODERATION tab, and the pre-existing 9 px avatar labels in `EntryGate.tsx` (separate fix).

---

## 6. Red-team log

Cycles 1-4 were run on 2026-11-24 (full tables in the 2026-11-24 plan). Summary of what they
fixed: stuck `STARTING...`, device-clock filtering, a never-refreshed standby, time zones and DST,
RLS update/delete reporting success on zero rows, the missing write grants, a Schedule crash
unmounting the live `GoLivePanel`, a second `#admin` tab mid-show, token expiry, the sign-in burst
at GO LIVE, a hostile RPC limit, a hand-added permissive policy, XSS, security-definer RPC,
async errors and the boundary, `datetime-local` support, test time zones. Accepted limit R1.7:
a show that ends inside its first 30 min reads STARTING SOON until the 30 min are up.

### Cycle 5 - D1, the guest flow before the gate
| # | Attack | Resolution |
|---|---|---|
| 5.1 | Station mode loads after the mount decision, so "standby or gate?" races. | Decided at render, not at mount: `gate` + off air renders standby. Unknown station: LOADING up to 3 s, then the gate. |
| 5.2 | A guest without a session may never hear that the station went live. | `station` is readable by anon (`station_read using (true)`, select granted), and `useStation` already re-reads every 60 s. Measured on a real phone with no session (V6): target under 5 s, ceiling 60 s. |
| 5.3 | Host ends while a guest is typing on the gate. | The gate turns into standby. Correct: there is nothing to hear. No sign-in is made until TUNE IN. |
| 5.4 | Does a waiting crowd cost Realtime clients? | Same single client a gate visitor holds today. No change. |
| 5.5 | Banned guest sees the countdown? | Banned check runs first, unchanged. |

### Cycle 6 - D4, pre-filling the title
| # | Attack | Resolution |
|---|---|---|
| 6.1 | Overwrites what the host typed. | Pre-fills only an empty field or one still holding the last pre-fill; a keystroke ends it. |
| 6.2 | Re-titles a running show. A dropped connection ends in `lost`, which shows `status === 'error'`, and GO LIVE from there re-sends the title. | Pre-fill only at `idle` with the station row not live; never writes `titleRef`. Test: lost + new suggestion leaves the title alone. |
| 6.3 | A console opened mid-show starts `idle` while the station is live. | Same guard: station row live blocks pre-fill. |
| 6.4 | Which show, with two the same day? | Earliest start in `[now - 30 min, now + 6 h]`. After END of the first (over 30 min past its start) the second becomes the suggestion. In one continuous broadcast the title stays the first show's, matching the owner's "only the neon track name changes" mode. |
| 6.5 | The owner may not expect the title to dominate the neon line. | Shown explicitly in the journeys (step H7 and L6). |
| 6.6 | `GoLivePanel` is the 2026-10-11 desync area. | Change limited to the title field and one prop. The plan's review step fails the task if the `GoLivePanel` diff touches anything else. No `GoLivePanel` effect depends on `title` (checked). |
| 6.7 | Schedule read fails, the console misbehaves. | No suggestion, nothing else changes. |

### Cycle 7 - Rollout, data, operations
| # | Attack | Resolution |
|---|---|---|
| 7.1 | **Vercel previews use the production Supabase project**, so test shows created on a preview appear on the real standby screen. | Test with real planned shows, or titles starting `TEST`, deleted straight after. Written into the validation steps. |
| 7.2 | Frontend deployed before the schema: the RPC is missing. | Schema delta first, probe, then merge. Standby treats a failed read as `unavailable` (no card), never TBA. The old production standby keeps working after the delta because the table is unchanged. |
| 7.3 | Applying SQL during a broadcast. | Delta applied off air only, as its own copy-paste block, followed by `rls-probe.mjs`. |
| 7.4 | Host abroad: the preview labelled "Israel" is wrong. | Preview shows the device's own zone, plus Israel and UTC, with an amber note when the device is not on Israel time. |
| 7.5 | Double tap on ADD inserts twice. | Button disabled while saving. |
| 7.6 | Two devices edit the same show. | Last write wins; lists re-read after every write and every 60 s. Accepted. |
| 7.7 | Test-count baseline is wrong in CLAUDE.md (says 68/588; `master` measures 67/587 on 2026-11-25). | Plan uses the measured baseline and corrects the CLAUDE.md line in its docs task. |

### Cycle 8 - Attacking the cycle 5-7 fixes
| # | Attack | Resolution |
|---|---|---|
| 8.1 | On a slow network the 3 s fallback shows the gate, then flips to standby. | Acceptable flicker; display never triggers a sign-in. |
| 8.2 | Console reload loses the "pre-filled" memory. | After a reload the field is empty, so pre-fill applies again. Correct. |
| 8.3 | A new prop re-renders `GoLivePanel` every 60 s. | It already re-renders on every listener-count change; no effect keys on `title`. |
| 8.4 | Time-zone labels differ by phone language (`GMT+2`, `EST`). | Show what `Intl` gives; tests pin locale and zone. |
| 8.5 | STARTING SOON pulse ignores reduced motion. | Added to the existing disable list. |

### Cycle 9 - Clean pass
Re-read sections 1-5 against the code paths they touch (`ListenerApp`, `useStation`,
`StandbyScreen`, `AdminConsole`, `GoLivePanel` title and status, `NowPlaying`, `radio-schema.sql`
grants and policies, `grants.test.ts`). No new findings at the time. Cycle 10, an independent red
team, then found B1 below, which is why an independent pass is part of the method.

### Cycle 10 - Independent red team (separate agent, read-only, verified against the code)
| # | Finding | Resolution |
|---|---|---|
| B1 | **Blocking. `scripts/rls-probe.mjs` cannot prove anything.** It sends the publishable key as a Bearer token, which is always rejected with 401, and counts any non-OK response as PASS (`rls-probe.mjs:19-22, 28-37`). Every "anon CANNOT ..." line passes whether RLS works or not. After the new grants, a refused update/delete is 200 with zero rows, which the probe would misread. **This also affects the probes in use today** (bans, chat insert), which have never been able to fail. | Task 1 rebuilds the `scheduled_shows` probes on supabase-js: one client with no session, one signed in anonymously, a fixture show created with the service key (dated in the past so it never reaches standby) and deleted in `finally`; every refused write must leave the fixture unchanged; `upcoming_shows` called with and without a session. Fixing the old probes is offered to the owner as a separate small task, since it is outside this feature. |
| S1 | Clearing the title (to get `LIVE DJ`) got re-filled within 60 s. | `hostEdited` flag (section 4.3). Test: host clears the field, it stays empty. |
| S2 | `useSchedule`, `suggestTitle` and the hint run outside the boundary; a throw reaches the top-level boundary and unmounts `GoLivePanel`. | Rule functions are total and tested with bad input; the hook catches every read error; the hint renders only while the field holds the pre-fill. |
| S3 | The RPC's clamp of 10 would hide the host's 11th show. | Host reads the table directly; RPC is guests only. |
| S4 | A preview test GO LIVE uses the production `station` row: every real guest keeping the page open is pulled to the gate, and D4 could broadcast a real show's title. | Test broadcasts away from announced shows, title typed as `TEST`. Written into Task 10 and CLAUDE.md. |
| S5 | No flow today depends on a no-session visitor reading `station`, `get_server_time` or the Realtime UPDATE. | Task 8.0: a Node check with no session (select, RPC, subscribe, see an UPDATE) before building D1. |
| S6 | Crowd wording incomplete; DB load is two reads per minute. | Section 1 corrected. |
| Nits | Test mock lacks `from`/`rpc`; `ListenerApp` not exported; the 3 s fallback needs a timer effect; `limit` reserved; delta block placed in a PR that does not exist yet; Phase 0 drop rule too narrow; station `null` case untested; PEEK vs ALWAYS; CLAUDE.md grants line. | All folded into the plan (tasks 0, 1, 5, 6, 8, 9). |

Claims the independent red team verified as true: `titleRef` set only at GO LIVE and re-sent on reconnect; lost state shows as `error`; no effect keys on `title`; `useStation` already runs for every visitor with one channel and a 60 s re-read; anon can read `station` (policy, grant, publication); `GoLivePanel` stays mounted on other tabs; the no-channel test exists; `grants.test.ts` covers `.update`/`.delete`; today's standby keeps working after the delta; 67 test files.

### Cycle 11 - Journeys design review (two passes)
Fixed in the prototypes: rows 2+ wrongly treated as past; the device frame is now a real viewport (iframe), so small, sideways and desktop layouts are true; date block in Israel time; STARTING SOON copy no longer claims the host is setting up ("Due any minute."); no invented zone names; pre-fill hint carries "Israel"; phone layout with a sticky step bar and a frame fitted between header and bar; BACK and step jumps replay the demo so every step is deterministic.

### Cycle 12 - Clean pass
Re-checked sections 1-5 and the plan after cycles 10-11. No new findings. **Ready to code once the owner signs off the journeys.**

## 7. Accepted limits
- R1.7: a show ended inside its first 30 minutes reads STARTING SOON until those 30 minutes pass.
- A guest sees a schedule change within 60 s, not instantly.
- Last write wins when two devices edit the same show.
- Preview testing writes to the production database (7.1), and a preview GO LIVE reaches real waiting guests (S4).
