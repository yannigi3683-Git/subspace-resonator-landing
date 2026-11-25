# Radio AUTO-RUN - Design Spec (Release 2 of SCHEDULE)

Status: **red-teamed (5 own cycles + independent red team, cycle A6) and revised. No code written.**
Date: 2026-11-25. Builds on `specs/2026-11-25-radio-schedule-design.md` (Release 1: show list,
SCHEDULE tab, guest countdown, title pre-fill). Plan: `plans/2026-11-25-radio-autorun.md`.

The owner's intent (2026-11-25): **a scheduled show starts and ends by itself.** Files are assigned
to each show in advance; at the start time the console goes live and plays them; when they finish
it ends the broadcast. Shows on the same day can be separate broadcasts or one continuous run.

---

## 1. Effect on broadcast quality and crowd size

| Concern | Effect |
|---|---|
| Audio quality | **Same as a manual file broadcast today.** AUTO-RUN uses the console's own GO LIVE, file deck and END. Publisher, mixer internals, ICE, jitter buffer and restreamer are untouched. |
| **Server code** | **One additive change to `api/rtc-session.ts`** (section 6.1): an optional "only if" condition on going live and on ending, so AUTO-RUN can never take over or end a show someone else started. Requests without it behave exactly as today. This is the file whose import mistake took the radio down on 2026-07-26, so it gets its own tests, a preview check with `npm run check:api`, and nothing else in that file changes. |
| Stability | **New risk: nobody is at the PC.** A failure that a present host would notice and fix (silence, a stuck deck, a lost connection) can now run unseen. Mitigated by preflight checks, automatic retries, a status line on the owner's phone, and the existing reconnect logic. Section 7 lists every failure. |
| Realtime clients / presence / anon sign-ins | **None added.** One row write per minute from the armed console (heartbeat) and one tiny database job per minute (the watchdog, 6.2). |
| Crowd size | Unchanged caps. Shows may now run at hours when the owner is not present, so chat runs unmoderated (owner's decision: chat open). |

## 2. Decisions

| ID | Decision | By |
|---|---|---|
| A0 | AUTO-RUN on the owner's PC, console left open. Not cloud. | Owner, 2026-11-25 |
| A0b | Failed start: guests see STARTING SOON, then DELAYED, then the next show. | Owner, 2026-11-25 |
| A0c | Chat stays open during automatic shows. | Owner, 2026-11-25 |
| E1 | Name **AUTO-RUN**. The console already has **AUTO** (automatic bitrate, `autoPilot` in `GoLivePanel.tsx:102`); one word must not mean two things. | Recommended |
| E2 | Files are **copied into the console's own storage on that PC** (the browser's private file storage, OPFS) when assigned. Linking to the originals instead needs a permission click after every Chrome restart. | Recommended |
| E3 | A show **ends when its last file finishes**. No separate end time. | Recommended |
| E4 | **Never cut a set.** If a show overruns into the next one's start time, the next show starts as soon as the first ends. Warned when files are assigned. | Recommended |
| E5 | **Two releases.** Release 1 (schedule, countdown, title pre-fill, about 24 h) ships first; Release 2 (AUTO-RUN, about 38 h) builds on it. | Recommended |
| E6 | Each show chooses what the neon line shows: **TRACK NAMES** (default, the owner's "only the neon track name changes") or **SHOW TITLE**. Each file can carry a display name. | Recommended |

## 3. What a show looks like now

`scheduled_shows` gains one column, `neon_mode` (`tracks` or `title`, default `tracks`), so a show
created from a phone carries it. **Files never go to the database or the cloud.** The show's
playlist (file copies, order, display names, durations) lives in the browser storage of the PC
that will play it, keyed by show id. A show with no files on that PC is announced as before and
AUTO-RUN skips it (the console says so in advance).

Two ways to run a day:
- **Separate broadcasts:** two shows, each with its own files. Show A ends (END BROADCAST, chat
  transcript saved), show B goes live at its own time. Guests between them see the countdown.
- **One continuous run:** one show holding all the files. Files play back to back with the
  existing auto-mix crossfade; only the neon line changes.

## 4. Host experience

### 4.1 Assigning files (on the PC that will play them)
In the SCHEDULE tab, each upcoming show has a **FILES** row: `No files on this PC` or
`4 files · 1:58:20 · on this PC`. Tapping it opens the show's playlist:
- ADD FILES (picker or drag-drop). Each file is copied into console storage; progress shown; a
  file that cannot be read is rejected with its name.
- Reorder (drag, plus up/down buttons for keyboard), remove, and an optional **display name** per
  file (what the neon line shows; defaults to the cleaned file name, as today).
- NEON: TRACK NAMES / SHOW TITLE.
- Total length, and a warning if the set runs past the next show's start ("Runs 25 min into
  Goa Classics 1998. That show will start when this one ends.").
- Storage line: `Using 812 MB on this PC. Storage is protected` or, if the browser refused
  persistent storage, an amber `The browser may clear these files if the disk fills up.`
- On a phone the row reads `FILES · assign on the broadcasting PC` (no ADD FILES: phones never play shows). On a PC without the files it reads `FILES · none on this PC` with ADD FILES.
- With files: `FILES · 4 files · 37:05 · on this PC`.

### 4.2 Arming
A bar at the top of the console, on every tab:
- `AUTO-RUN OFF` + **ARM** (44 px). Turns red with `Next show in 3 h has files but AUTO-RUN is
  off` when relevant.
- ARM requires a click, on purpose: browsers only let a page start audio after the person has
  clicked on it. The click is what lets AUTO-RUN start sound later with nobody there.
- Armed: `AUTO-RUN ARMED · Psy Night Vol. 7 at 22:00 · checks OK 1 min ago` + DISARM. After a show it adds `Last: Psy Night Vol. 7 ended 22:37, chat log saved`, so a host coming back can see it ran.
- Only one console anywhere can be armed (a lease in the database, refreshed every minute,
  expires after 3 min). A second console shows `Armed on another console (PC-STUDIO), seen 40 s ago`.
- **Any reload or restart disarms**, and the console asks for the full sign-in again (it does not
  resume a session today). The bar and the owner's phone show it.

### 4.3 What happens at show time
| When | AUTO-RUN does |
|---|---|
| T - 10 min | Preflight: signed in as host **at 2FA level**, files readable and complete, station off air (read fresh, not from a possibly stale subscription), lease held, audio allowed (a test audio context resumes within 3 s, then is closed), network up, restreamer seen recently. Result on the bar and in the heartbeat. A failed check retries every 30 s. |
| T - 45 s | Goes live with an **empty deck** and **no input device** (Windows sounds must never go on air unattended), the show title and neon mode, using the "only if off air" condition. Records its own broadcast id in `autorun_status`. Guests waiting on the countdown move to the entry screen. |
| T | Loads the show's files (REPEAT forced off) and starts the deck. |
| A file will not play | Skipped, logged in the heartbeat; the show continues. |
| Last file ends | Waits **30 s** (deep-buffer listeners are 8-20 s behind), then ends the broadcast using "only if this is still my broadcast". |
| Safety net | A hard END at start + total length + **time spent paused** + 2 min, whatever the deck reports. |
| Next show | At least **15 s** after the previous END, so the restreamer sees a real END (and sweeps storage) rather than a reconnect. If the previous show overran, the next one starts as soon as that gap has passed (E4). |
| Connection lost mid-show | AUTO-RUN sends the same reconnect the browser's `online` handler sends. It never rebuilds the mixer or restarts the track. |
### 4.4 When a start fails
The console retries every 30 s until T + 30 min, then marks the show **MISSED** and moves on. If a
failed attempt left the station marked live with **AUTO-RUN's own** broadcast id, the retry resumes
that broadcast instead of reporting "already live", and MISSED ends it, so guests are never left
in a silent live room. Each failure shows on the bar with its reason and in the heartbeat.

### 4.5 Seeing it from the phone
In `/radio` with host mode on (the existing padlock sign-in), one line at the top of the screen. Off air there is no chat header, so the standby screen gets the same small padlock (listeners can see it, as they already see it in the room; only the host can sign in through it). The line:
`AUTO-RUN · armed on PC-STUDIO · next Psy Night Vol. 7 22:00 · seen 1 min ago`, amber when the
heartbeat is over 3 min old (`last seen 2 h ago`, the PC is probably off or asleep), red on
START FAILED or MISSED (the missed show is named, for 24 h), grey when AUTO-RUN is off. Read-only; arming happens only at the PC.

## 5. Guest experience
| Time | Guest sees |
|---|---|
| before T - 45 s | Countdown (Release 1). |
| T - 45 s | Station goes live, the page moves to the entry screen; audio starts at T. |
| T to T + 10 min, not live | STANDING BY / STARTING SOON. |
| T + 10 to T + 30 min, not live | **DELAYED** ("The signal is late."; the screen already says "Keep this page open" below). |
| after T + 30 min | Countdown to the next show, or TBA. |
| In the room | Neon shows track names (or the show title, per show). |

Release 1's 30-minute STARTING SOON window becomes 10 min STARTING SOON + 20 min DELAYED.

## 6. Data and server
- `scheduled_shows.neon_mode text not null default 'tracks' check (neon_mode in ('tracks','title'))`.
- New singleton table `autorun_status`: `id`, `device_id`, `device_label`, `armed`, `heartbeat_at`,
  `state` (`off`, `armed`, `preflight`, `starting`, `on_air`, `failed`), `next_show_id`,
  `message`. RLS: read and write only for admin with aal2 (`is_admin_aal2()`), nothing for anon or
  listeners. Grants: select, insert, update to authenticated. Arming is a conditional update
  ("only if the lease is free, expired, or already mine") that must return one row; zero rows
  means another console holds it.
- The lease belongs to **one tab**, identified by a random id created when the page loads and held only in memory, so two tabs in the same browser cannot both arm. Claim and heartbeat are database functions that use the server clock.
- `autorun_status` also records AUTO-RUN's current broadcast id (`cfSessionId`) and its state, so the watchdog and the retries can tell AUTO-RUN's broadcast from a manual one.

### 6.1 Server condition (additive)
`publish-offer` accepts an optional `expect`: `off` (go live only if the station is off air) or a broadcast id (reconnect only if the station still holds that id). With `expect`, the station update is conditional and a miss returns **409 station_busy**. `end-broadcast` accepts the same `expect` id and ends only on a match. Without `expect`, both behave exactly as today. Manual GO LIVE and END never send it.

### 6.2 Watchdog (database job, every minute)
If `autorun_status.state` is on air, its heartbeat is over 5 minutes old, and the station still holds **AUTO-RUN's** broadcast id, the job takes the station off air (the same row change END makes). It can never touch a manual show. The chat log stays in the database for 48 h and can be downloaded with DOWNLOAD CHAT LOG. Needs `pg_cron`, which the chat clean-up already uses; Phase 0 confirms it is enabled on the live project.

- Local only (browser storage on the PC): file copies (OPFS), playlist order, display names,
  durations, keyed by show id. Orphans (show deleted) are offered for cleanup.

## 7. Failure matrix
| Cause | Console | Phone line | Guests | Recovery |
|---|---|---|---|---|
| PC asleep / off / restarted | gone | amber "last seen ..." | SOON, DELAYED, next | Owner signs in, ARM |
| Console tab closed or reloaded | gone or disarmed | amber | same | Sign in, ARM |
| Not armed | red bar | "AUTO-RUN off" | same | ARM |
| Sign-in expired | START FAILED: sign-in | red | same | Reload, sign in, ARM |
| Files missing or unreadable | preflight fails at T-10 | red | same | Re-add files |
| Audio blocked (no click since load) | preflight fails | red | same | ARM click |
| Network down | retries every 30 s | stale | same | Automatic when back (until T+30) |
| Station already live (manual show, or a live flag left by a crashed console) | START FAILED: already live | red | the live show | Owner ends it |
| Connection lost mid-show | existing reconnect; after the ~31 s budget AUTO-RUN presses GO LIVE again, same broadcast and chat | amber | short silence | Automatic |
| Set overruns next start | next show waits | "waiting for ..." | next show starts late | Automatic |
| Failed start left the station live with AUTO-RUN's own id | retries resume it; MISSED ends it | red | entry screen, then back to the countdown | Automatic |
| Console tab crashes or the PC loses power mid-show | gone | amber | silent live room for up to 5 min | Watchdog ends it (6.2) |
| Chrome Memory Saver discards the tab | gone | amber | same as above | Guide: add the site to "Always keep these sites active" |
| Signed out after a failed token refresh, or 2FA level dropped | START FAILED: sign-in | red | SOON, DELAYED, next | Sign in, ARM |
| Restreamer not running (PC rebooted) | bar shows DEEP BUFFER OFF after start | amber | WebRTC only (locked phones lose audio) | Start the restreamer |
| Disk full while copying files | copy fails, file named | - | - | Free space |
| A file will not play | skipped, logged | note | next track | Re-add the file later |
| Transcript download blocked (Chrome "multiple downloads") | END still completes | - | - | Allow automatic downloads once; DOWNLOAD CHAT LOG within 48 h |

## 8. Browser and PC requirements (go in the host guide)
- Chrome, console window open and **visible**. A minimised window, and possibly a locked screen or a switched-off display, counts as hidden: timers may fire only once a minute and the wake lock is released. The scheduler therefore runs in a dedicated background worker, and start accuracy is measured with the screen locked (V-A1). Until that measurement says otherwise, the guide says: leave the screen unlocked and the display on before a show.
- Chrome Memory Saver: add the site to "Always keep these sites active".
- Windows: Sleep **Never** while armed; Windows Update active hours cover show times; never log
  out (logging out kills the show, as today). `Win+L` lock is fine.
- Chrome: allow automatic downloads for the site (transcripts).
- Restreamer running on the same PC as usual (deep buffer).

## 8b. Naming
The console already shows AUTO (auto bitrate), AUTO-PILOT and AUTO-MIX. AUTO-RUN is a fourth AUTO word; the owner may prefer another name (for example SHOW RUNNER). Decide before building.

## 9. Out of scope
Cloud playout; push or e-mail alerts; automatic sign-in after a restart; mixing a live input
device into an automatic show; assigning files from a phone; recurring shows.

---

## 10. Red-team log (own cycles)

### Cycle A1 - Can it start sound with nobody there?
| # | Attack | Resolution |
|---|---|---|
| A1.1 | Chrome blocks audio started without a click, so a timer-driven GO LIVE could go on air silent. | ARM is a click, which gives the page lasting permission until reload. Preflight at T-10 resumes a test audio context and fails loudly if it stays suspended. Verified on the owner's PC (V-A1), since a test runner cannot prove it. |
| A1.2 | A minimised console runs timers once a minute. | Start sequence at T-45 s; guidance to keep the window visible; start accuracy measured minimised and visible (V-A1). |
| A1.3 | The PC sleeps. | Wake lock held while armed and visible (today it is held only while live); Windows Sleep Never in the guide; the phone line shows a stale heartbeat. |

### Cycle A2 - Can it start twice, or on top of something?
| # | Attack | Resolution |
|---|---|---|
| A2.1 | Two armed consoles (two tabs, two PCs, preview + production). | Database lease with a conditional update; second console cannot arm. |
| A2.2 | Owner is DJing manually when a show is due. | Never starts while the station is live; reports START FAILED: already live. |
| A2.3 | A live flag left behind by a crashed console blocks every later show. | Reported, not auto-cleared: clearing it automatically could cut a real show on another device. Visible on the phone line. Accepted limit. |
| A2.4 | Overrun. | E4, warned at assignment. |

### Cycle A3 - Files
| # | Attack | Resolution |
|---|---|---|
| A3.1 | Browser storage cleared under disk pressure. | Ask for persistent storage; show whether it was granted; preflight checks every file's size. |
| A3.2 | Copies double disk use. | Size shown; option to delete a show's copies after it airs. |
| A3.3 | Show deleted or moved. | Files keyed by show id, so a move keeps them; delete offers cleanup. |

### Cycle A4 - Driving the console programmatically
| # | Attack | Resolution |
|---|---|---|
| A4.1 | `GoLivePanel` is the 2026-10-11 desync area; new code paths could recreate it. | AUTO-RUN only calls the existing GO LIVE, deck load, play and END handlers through a small handle. No new transport logic. A diff gate on `GoLivePanel.tsx`, the existing deck tests, plus an overnight 3-show rehearsal and a 48 h armed soak. |
| A4.2 | REPEAT left on means a show never ends. | AUTO-RUN forces REPEAT off for its shows. |
| A4.3 | Deck end during a crossfade. | The existing `handleDeckEnded` already defers to the fade; END fires 5 s after the queue reports finished. |
| A4.4 | Mid-show connection loss ends in the terminal `lost` state with nobody to press GO LIVE. | AUTO-RUN presses GO LIVE from `lost`, which today preserves `startedAt`, listeners and chat. |

### Cycle A5 - Honesty to the owner and guests
| # | Attack | Resolution |
|---|---|---|
| A5.1 | Armed but silently dead (PC off). | Phone line shows heartbeat age; guests see DELAYED, never a false countdown. |
| A5.2 | "STARTING SOON" forever. | 10 min, then DELAYED for 20 min, then move on. |
| A5.3 | Owner thinks a reload keeps AUTO-RUN on. | Reload disarms and requires sign-in; stated on the bar, in the guide and in the journeys. |
| A5.4 | Testing on a preview goes live for real (same database, same station row). | Test only at off-hours with `TEST` shows; the lease stops a preview console and the production console both being armed. |

### Cycle A6 - Independent red team (separate agent, verified against the code)
| # | Finding | Resolution |
|---|---|---|
| B1 | The server marks the station live before the audio connection is up (`api/rtc-session.ts:388`), so a failed start strands it live and every retry then fails as "already live"; MISSED never ends it. | AUTO-RUN records its broadcast id; retries resume its own broadcast; MISSED ends it (4.4). |
| B2 | Nothing on the server prevents a double broadcast: GO LIVE overwrites any live session. The station subscription can be stale in a hidden tab, and two tabs share a device id. | Server `expect` condition (6.1); per-tab lease id; lease in a database function on the server clock; preflight reads the station fresh. |
| B3 | An unreadable file stops the deck with no next and no end (`GoLivePanel.tsx:763`); there is no "queue finished" signal. | Skip on error during AUTO-RUN; new queue-finished callback; hard END at start + total + 2 min. |
| B4 | A crash or power cut leaves the station live forever; the unload beacon's token expires after about an hour. | Watchdog job (6.2); the heartbeat also refreshes the cached token. |
| S1 | GO LIVE plays a loaded deck at once, so "load at T-45" would go out 45 s early. | Go live with an empty deck; load and play at T. |
| S2 | Recovery through GO LIVE rebuilds the mixer and restarts the track. | Send the existing reconnect event instead. |
| S3 | Setting the title then pressing GO LIVE sends the old title; REPEAT is a toggle. | The handle takes explicit arguments and sets REPEAT off directly. |
| S4 | GO LIVE adds the selected input device. | AUTO-RUN shows go out with no input device. |
| S5 | A locked screen may count as hidden: throttled timers, no wake lock. | Worker scheduler; measured with the screen locked; guide wording changed. |
| S6 | Ending 5 s after the last file cuts deep-buffer listeners. | 30 s. |
| S7 | END then GO LIVE inside the restreamer's 3 s poll reads as a reconnect. | At least 15 s between shows. |
| S8 | Missing failures: Memory Saver, tab crash, sign-out after failed refresh, restreamer off, disk full, 2FA level drop. | Added to section 7. |
| S9 | The live wake lock is released at END. | AUTO-RUN holds its own. |
| Nits | Third AUTO word; server clock; audio test can hang; OPFS is per site address, so files assigned on a preview do not exist on production; slow mode for unattended shows. | Naming left to the owner (8b); server clock used; 3 s timeout; preview tests assign their own files; slow mode offered, owner chose open chat. |

Verified true by the independent red team: a console reload always shows the sign-in screen; GO LIVE from `lost` keeps `startedAt`; a crossfade owns the move when a track ends; the wake lock is held only while live; auto bitrate is `autoPilot`. Cannot be verified without the owner's PC: locked-screen behaviour, Memory Saver, persistent-storage grant, 2FA level over days, start accuracy, the restreamer across back-to-back shows.

### Cycle A7 - Attacking the A6 fixes
| # | Attack | Resolution |
|---|---|---|
| A7.1 | The server change could break every broadcast, manual included. | Additive and optional; a test proves a request without `expect` produces the same station write as today; preview + `npm run check:api`; `api/importExtensions.test.ts` already guards the `.js` import rule. |
| A7.2 | The watchdog ends a healthy show whose PC is merely slow to beat. | Five missed minutes at a one-minute beat from a worker timer; the beat runs in the worker, which keeps time when the page is hidden. |
| A7.3 | Watchdog and AUTO-RUN both end at once. | Both use "only if this broadcast id", so the second is a no-op. |
| A7.4 | A guest could see DELAYED for a show that already aired early or ended within 30 min. | Shows are marked aired when a broadcast goes live for them (both releases); aired shows never show as late. |

### Cycle A8 - Clean pass
Re-read sections 1-9 and the plan against the files they touch. No new findings. Ready for the owner's journey review.
