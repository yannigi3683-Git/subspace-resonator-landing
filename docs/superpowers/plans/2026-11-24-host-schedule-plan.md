# Host Console SCHEDULE tab - Plan for approval

Status: **PLAN ONLY, awaiting owner approval. No code written.**
Date: 2026-11-24. Implementation branch, once approved: `feat/radio-schedule` off `master`.

---

## 0. Effect on broadcast quality and crowd size (the CLAUDE.md rule, stated first)

| Concern | Effect | Why |
|---|---|---|
| Broadcast audio / stability | **None** | Nothing in `src/radio/rtc/*`, `GoLivePanel.tsx`, the restreamer, or `api/rtc-session.ts` is touched. Schedule data rides Supabase Postgres; audio rides the Cloudflare SFU. The one real hazard (a Schedule crash unmounting `GoLivePanel` mid-show) is closed by an error boundary, see R2.1. |
| Realtime clients (200 cap) | **None added** | Standby re-reads the schedule with a plain select every 60s. No new channel, no new client, no presence. |
| Presence events (20/s cap) | **None** | Nothing tracks. |
| Anon sign-ins (300/h per IP) | **Unchanged, or lower** if Decision D1 is approved | D1 lets off-air visitors see the countdown *without* passing the entry gate. Today they must burn an anon sign-in just to read "next show", and are sent back through the gate at GO LIVE anyway. |
| DB load | Negligible | One indexed select per standby viewer per minute, only while off air and the tab is visible. |

---

## 1. What exists today (found while planning)

The roadmap item is the console placeholder "Scheduled shows - coming in M8" (`AdminConsole.tsx:101`). It is half-built:

| Piece | State |
|---|---|
| `scheduled_shows` table (`id, title 1-80 chars, starts_at, created_at`) | In `radio-schema.sql`. RLS: read `true`, write `is_admin_aal2()`. **Not verified in the live DB.** |
| Grants | `select` only for anon/authenticated. **No insert/update/delete grant** - on a fresh project the console could never write (the silent-grant trap from 2026-10-30). |
| `StandbyScreen.tsx` countdown | Built, shown off air. Has 5 defects, listed below. |
| Host UI to add/edit/delete shows | **Does not exist.** Today the only way to schedule is the Supabase dashboard. |
| `rls-probe.mjs` | Checks anon cannot *insert*. Does not check update/delete. |

Defects in the current standby countdown:

1. **Fetched once at mount, never re-read.** A show added, moved or deleted while someone waits never reaches them.
2. **Filters on the device clock** (`.gt('starts_at', new Date())`), not server time. A phone with a wrong clock hides or shows the wrong show.
3. **Hits zero and says `STARTING...` forever** if the host is late, until reload.
4. **No days.** A show 12 days out renders as `292:00:00`.
5. **`aria-live="polite"` on a value that changes every second** - a screen reader announces the countdown continuously.

And one flow problem: **the standby screen sits behind the entry gate.** An off-air visitor must pick a name and avatar and spend an anonymous sign-in before learning when the next show is, then is forced back through the gate at GO LIVE anyway (`shouldForceReentry`). See D1.

---

## 2. Scope

**In:**
- SCHEDULE tab in the host console: list upcoming shows, add, edit, delete (two-tap, like BAN), collapsed list of recent past shows.
- Fix the 5 standby defects above.
- Standby shows the next show big, plus up to 2 more ("LATER") - D2.
- Shows render in the **viewer's** local time with the zone named; host sees the entered time echoed back in Israel time and UTC before saving.
- Off-air visitors see standby **before** the gate - D1.
- Schema: write grants, one read RPC, docs, tests, RLS probe coverage.

**Out (deliberately):**
- **Auto GO LIVE.** Impossible by design: audio originates in the host's browser. The schedule is an announcement, not an automation.
- Showing radio shows on the landing page (separate `events` system in `siteContent.ts`; landing bundle rule).
- Add-to-calendar `.ics`, share buttons, recurring shows, notifications/reminders.
- Prefilling the GO LIVE title from the scheduled show - touches `GoLivePanel`; deferred, D4.
- Console MODERATION tab (separate placeholder, separate feature).

---

## 3. Design

### 3.1 Data (one schema pass, `radio-schema.sql`)
- `grant insert, update, delete on scheduled_shows to authenticated;` (RLS still restricts writes to admin + aal2; the grant is only the second gate). `grants.test.ts` will enforce it automatically once the console calls `.insert/.update/.delete`.
- New RPC `upcoming_shows(_limit int)` - `language sql stable`, **security invoker** (RLS still applies), returns `id, title, starts_at` where `starts_at > now() - interval '30 minutes'`, ordered ascending, limit clamped to `least(_limit, 10)`. Server clock decides what is "upcoming", so device clocks no longer matter. `grant execute ... to anon, authenticated`.
- Index on `starts_at` (tiny table, but free).
- No new columns. No `ends_at`, no `aired` flag (see R1.7 for why).
- Existing `drop policy if exists` pattern extended to any hand-added `scheduled_shows` policy found in the Phase 0 audit.

### 3.2 Pure logic (`src/radio/scheduleRules.ts`, fully unit-tested)
- `validateShow({title, startsAt}, now)` - title 1-80 after trim, valid date, warns (not blocks) on a time in the past and on another show within 60 min.
- `standbyState(shows, serverNow)` - returns `{ kind: 'countdown' | 'starting-soon' | 'tba', next, later[] }`. `starting-soon` covers `starts_at <= now < starts_at + 30 min`.
- `formatCountdown(ms)` - `3d 04:22:10` / `04:22:10` / `22:10`.
- `formatShowTime(iso, timeZone?)` - `Intl.DateTimeFormat` with `timeZoneName: 'short'`; explicit-zone parameter so tests do not depend on the CI machine's TZ.

### 3.3 Host SCHEDULE tab (`src/radio/admin/SchedulePanel.tsx`)
- Rendered inside a **local error boundary** in `AdminConsole`; `GoLivePanel` stays mounted and hidden exactly as today.
- Form: title + `datetime-local` (host device time) + live preview line: "Sat 29 Nov 22:00 Israel · 20:00 UTC · in 4d 3h". 44px targets throughout.
- List: upcoming ascending, each row EDIT / DELETE (two taps). "PAST (5)" collapsed.
- Every write uses the console's existing aal2 client. **Every update and delete chains `.select('id')` and treats 0 rows as a failure** shown in red. Insert errors shown verbatim.
- Re-reads after each write and on tab open.

### 3.4 Standby screen
- Reads `upcoming_shows(3)` on mount, every 60s while visible, and on `visibilitychange` (same pattern as `useStation`).
- Counts down against `getServerTime()`; at zero switches to `STARTING SOON` for 30 min, then advances.
- Absolute time line in viewer local time with zone. `aria-live` moved off the ticking digits onto the state line (announces "starting soon", not every second).
- Copy follows voice rules (no em dashes, terse).

### 3.5 Pre-gate standby (D1)
- `ListenerApp`: if off air and no valid in-room session, render `StandbyScreen` (new view `standby`) instead of `EntryGate`. When the station flips live, the existing `shouldForceReentry` effect already routes to the gate. A returning visitor with a session keeps today's path.
- Banned check stays first.

---

## 4. Red team (4 rounds, every finding resolved)

### Round 1 - Is what the listener sees true?
| # | Attack | Resolution |
|---|---|---|
| R1.1 | Host is late: countdown hits zero and sits on `STARTING...` forever. | 30-min `starting-soon` grace, then advance to the next show. 60s re-read means the change actually arrives. |
| R1.2 | Device clock is wrong: client-side filter shows or hides the wrong show. | Server decides membership (`upcoming_shows` uses `now()`); countdown uses the existing `useServerClock` offset. |
| R1.3 | Host deletes or moves a show; waiting listeners keep the old one. | 60s re-read + `visibilitychange`. Worst case is 60s stale, stated in docs. |
| R1.4 | Time zones: host in Israel, listener abroad, DST transitions (Israel's dates differ from EU/US). | Store `timestamptz` (absolute instant). Display in viewer zone with zone name. Host sees the stored instant echoed in Israel + UTC before saving, so a device with a wrong zone or a DST-gap time is visible before it ships. Device test in two zones (V5). |
| R1.5 | RLS silently "succeeds": an update/delete denied by RLS returns 200 with zero rows, so the console would show success after an aal downgrade or sign-out. | `.select('id')` on every update/delete; zero rows = visible error. Unit-tested with a mocked zero-row response. |
| R1.6 | Missing grant: fresh project, policy looks right, console cannot write. | Explicit grant; `grants.test.ts` fails the build without it. |
| R1.7 | Short show: host goes live 20:00, ends 20:10; standby says `STARTING SOON` for the show that just aired until 20:30. | **Accepted limit**, documented. Fixing it needs either an `aired` write in the GO LIVE path (touches the frozen-adjacent go-live flow, rejected) or reading `admin_audit` (anon cannot, by design). Host can delete the show in two taps. |

### Round 2 - Can this hurt a live broadcast or the room size?
| # | Attack | Resolution |
|---|---|---|
| R2.1 | A render crash in the Schedule tab unmounts the whole `AdminConsole`, including `GoLivePanel`. Its own comment says that orphans a live RTCPeerConnection: audio keeps going but the host loses END BROADCAST. | Local error boundary around `SchedulePanel` only. Test: a forced throw inside it leaves `GoLivePanel` mounted and its controls present. |
| R2.2 | Host opens `radio.html#admin` on a second device mid-show to edit the schedule; that tab renders GO LIVE / END against the live row (existing CLAUDE.md hazard). | Edit from the existing console tab while on air. Stated in the host guide and CLAUDE.md. Editing from a second device is safe only off air. |
| R2.3 | Admin JWT expires after 1h; a schedule write 3h into a show fails. | supabase-js auto-refresh on the console client keeps aal2 (same mechanism END BROADCAST already relies on hours in). Verified, not assumed: V4 writes a show >1h into a test broadcast. R1.5 makes any failure visible. |
| R2.4 | D1 moves anon sign-ins from "whenever people arrive" to "the moment GO LIVE fires" (a burst). | Total sign-ins never go up, and today's waiters are already forced through the gate at GO LIVE. The cap is per IP per hour, so a burst only matters for >300 people on one IP, which is over the cap either way. Net capacity effect: neutral to positive. |
| R2.5 | Pre-gate standby needs to know when the station goes live, which might add a Realtime client per visitor. | It does not: `useStation` is already called at the top of `ListenerApp` for every visitor, gate included. No new client. |
| R2.6 | Hostile caller hammers `upcoming_shows` with a huge limit. | Limit clamped server-side to 10; same anon-key rate limits as every other read. |

### Round 3 - Abuse and privacy
| # | Attack | Resolution |
|---|---|---|
| R3.1 | A hand-added permissive `true` policy on `scheduled_shows` (the 2026-07-26 pattern) lets anyone write fake shows with abusive titles onto every standby screen. | Phase 0 live audit (V0). Any such policy dropped explicitly in the schema file. `rls-probe.mjs` extended: anon AND an anonymous-signed-in listener cannot insert, update, or delete. |
| R3.2 | XSS via title. | Rendered as React text, never HTML; DB caps 80 chars. Existing chat XSS batch reused in tests. |
| R3.3 | Schedule leaks an invite-only station's plans. | Intended: it is an announcement, and the existing policy is already public read. `/radio` stays `noindex`, not in the sitemap. No change. |

### Round 4 - Red team the resolutions
| # | Attack on a fix | Resolution |
|---|---|---|
| R4.1 | The RPC as `security definer` would bypass RLS. | Specified **security invoker**. RLS probe calls it as anon. |
| R4.2 | Error boundaries do not catch async/event-handler errors. | Those do not unmount the tree, so they cannot orphan the broadcast; they surface through the R1.5 error line. Only render errors needed the boundary. |
| R4.3 | D1 could strand a returning listener (session + identity) on standby when live. | Returning visitors keep today's path. New `standby` view is covered by the existing `shouldForceReentry` effect, which runs for every view except `banned`/`loading`. Tests: off air → standby with no sign-in call; flip live → gate; banned stays banned. |
| R4.4 | `datetime-local` on iOS Safari / Android Chrome. | Supported on both. design-critic pass + real phone (V3). |
| R4.5 | The 30-min grace hides a show whose host is 40 min late. | Then standby shows the next show or TBA, which is honest. 30 min is a constant, owner can pick (D3). |
| R4.6 | The test machine's time zone makes date tests pass on one machine and fail on another. | All formatting functions take an explicit zone; tests pass zones explicitly and never read the process TZ. |

No open findings after round 4.

---

## 5. Phases and effort

| Phase | Work | Estimate |
|---|---|---|
| 0 | Live DB audit (owner runs 2 SQL queries, see V0). Blocks Phase 1. | 15 min owner |
| 1 | Schema: grants, RPC, index, policy cleanup. `rls-probe.mjs` update/delete checks. | 1.5 h |
| 2 | `scheduleRules.ts` + tests (validation, standby state machine, formatting, zones) | 2.5 h |
| 3 | `SchedulePanel` + error boundary + tests (CRUD, zero-row failure, two-tap delete, boundary isolation) | 5 h |
| 4 | StandbyScreen fixes + LATER list + tests | 2.5 h |
| 5 | D1 pre-gate standby + `ListenerApp` tests | 2 h |
| 6 | design-critic on all device sizes, fix round | 1.5 h |
| 7 | Docs: CLAUDE.md, spec, QA checklist, host guide (`build_guide.py` + PDF), beta guide | 1.5 h |
| 8 | Vercel preview validation with owner (V1-V6) | 1 h owner + 0.5 h |
| | **Total** | **~17 h build (2-3 sessions) + ~1.5 h owner** |

Tests: roughly +30 (68 files / 588 → about 71 / 618). Count only grows.
Risk level: **low**. No audio path, no server function, no restreamer. The only shared surface is `AdminConsole` (covered by R2.1) and the `ListenerApp` view switch (covered by R4.3). Phase 5 (D1) is the riskiest piece and is independently droppable.

---

## 6. Validation needed

| ID | Check | Who / where |
|---|---|---|
| V0 | `select policyname, cmd, permissive, qual, with_check from pg_policies where tablename='scheduled_shows';` and `select grantee, privilege_type from information_schema.role_table_grants where table_name='scheduled_shows';` Expect only `shows_read` / `shows_write`, no bare `true` on writes. Also `select count(*) from scheduled_shows;` | Owner, Supabase SQL editor, before Phase 1 |
| V1 | `npm run build` + `npx vitest run` clean; `grants.test.ts` green; count grew | Me, every phase |
| V2 | `node scripts/rls-probe.mjs` all PASS (anon and listener cannot write; RPC readable) after the schema is applied | Me or owner, after schema |
| V3 | Preview: add / edit / delete from desktop console **and** a phone; zero-row failure path forced by signing out in another tab | Owner + me |
| V4 | Private test broadcast: with a listener phone on `/radio?debug`, edit the schedule from the console >1h after GO LIVE. Audio uninterrupted, write succeeds, END BROADCAST still works | Owner, real devices |
| V5 | Second device set to a different time zone (e.g. New York): standby shows the correct local time and the same countdown as the Israel device | Owner |
| V6 | Off air in a private window: countdown visible with no name/avatar prompt; host GO LIVE moves that window to the gate | Owner |
| V7 | Post-deploy: `npm run check:api` prints `API ALIVE`; served radio bundle hash changed. Sitemap `lastmod` untouched (`/radio` is not in it) | Me |

---

## 7. Decisions needed from you

| ID | Question | Recommendation |
|---|---|---|
| **D1** | Show the standby countdown to off-air visitors **before** the name/avatar gate? | **Yes.** Saves sign-ins, and the pre-show gate does nothing today (everyone is re-gated at GO LIVE). Droppable on its own if you prefer to keep the flow as is. |
| **D2** | How many shows on standby? | Next show big + up to 2 under "LATER". |
| **D3** | Grace window after start time before standby gives up on a late show? | 30 min. |
| **D4** | GO LIVE title auto-filled from the scheduled show? | **Not now.** It touches `GoLivePanel`; separate small follow-up if wanted. |

Reply with approval (and any changes to D1-D4) and I will start Phase 0.
