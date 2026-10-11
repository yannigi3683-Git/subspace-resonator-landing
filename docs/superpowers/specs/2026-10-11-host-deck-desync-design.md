# Host file deck: a removed track kept playing and no control could stop it

Branch: `fix/host-deck-desync` · Incident: 2026-10-10 broadcast from the main PC · Written 2026-10-11

## The report

> Suddenly music that was removed from the playlist played, while another file was playing. I could
> not change it even after I deleted the whole playlist and then added the required file again. It
> was solved only after I stopped the broadcast and started again.

Host confirmed: heard on a **listener device** (so it was in the broadcast), **AUTO-MIX was on**,
unsure whether REMOVE ALL or per-row REMOVE was used, unsure whether the deck had files queued at
GO LIVE.

## What the restreamer log proves, and what it does not

`restreamer/logs/2026-10-10.log`, read against `restreamer/src/index.mjs:54`, `station.mjs:8-11`
and `cfPull.mjs:25`. **`GO LIVE <id>` logs the HOST's `cfSessionId` from the station row;
`subscribe-pull OK <id>` logs the restreamer's OWN subscriber session.** Confusing the two produces
a false reading of this log, which is what happened on the first pass of this investigation.

| time | line | what it means |
|---|---|---|
| 17:20:47 | `GO LIVE db6707…` | host went live |
| 19:07:59 | `ffmpeg exited 0 - will restart on next poll` | the **restreamer's** pull ended; station row still `live` |
| 19:08:14 | `GO LIVE db6707…` (new `subscribe-pull` id) | the restreamer restarted its own pull, **same host session** |
| 19:16:54 | `END db6707…` | host pressed END BROADCAST |
| 19:17:00 | `GO LIVE e47c54…` | host pressed GO LIVE again — the recovery described above |

Host session `db6707…` is **unchanged from 17:20:47 to 19:16:54**. Every re-publish path
(`handleGoLive`, the FSM auto-reconnect, the `online` auto-resume) mints a new `cfSessionId`, so the
log **excludes** a host reconnect, a second mixer and an orphaned session during the incident.

Not explained, and out of scope: why ffmpeg exited 0 at 19:07:59, and the 15s restart gap (the
poll is 3s). ffmpeg's stderr is inherited by the console window, so the reason was never logged.
Nothing in the web app can cause it, and the restreamer is structurally blind to playlists and
elements — so the log gives **no timestamp for the deck fault** and the incident window is only
"before 19:16:54".

## Root cause

**What an `<audio>` element has LOADED was a source of truth no code read and nothing reconciled.**
The deck carried three: the `LocalDeck` model (queue + `currentIndex`), the two elements' loaded
resource, and the mixer's per-source gains. Removing a track revoked its blob URL and spliced the
array — but revoking a blob URL does **not** unload a resource the element already fetched, and
nothing touched the element.

Two defects, each sufficient alone:

1. **`handleRemoveTrack` → `LocalDeck.remove` left the element playing a removed track**, and
   removing a track *before* the current one decremented `currentIndex`, so `deck.current` /
   `deck.next` silently stopped describing what was audible. → *"music that was removed played."*
2. **`handleDeckPlayPause` resumed a stale `src`.** Its only guard was `!el.src`, which catches
   "never loaded" but not "loaded a track that has since been deleted". After REMOVE ALL + re-add,
   PLAY resumed the deleted track; `currentTrackName` was `''` so the UI read "Live input" over it.
   With `filePlaying` left `true` by a previous `finalizeCrossfade`, the first press paused and the
   second resumed the deleted track — "the button does nothing". **This is also why only
   END + GO LIVE cured it:** that path mints a brand-new element.

AUTO-MIX defaults ON with a **12-second** crossfade, which supplies the *"while another file was
playing"* clause and a 12s window in which a queue edit desynced everything: REMOVE ALL paused only
the active deck while the incoming one was already ramped to full gain; `finalizeCrossfade` called
`deck.advance()` blind, never checking the track it faded in was still `deck.next`; `handleJumpTo`
had no fade guard, so a row click landed on the deck whose gain was ramping to zero; and NEXT/PREV
were dead no-ops for the whole fade.

One path could not be excluded (the host does not remember the deck's state at GO LIVE): going live
with an **empty** queue skipped the file branch entirely, leaving `audioElRef` pointing at the
mount element, which was **never attached to a `MediaElementSource`** and therefore played to the
Windows default output — Voicemeeter on this rig, i.e. back into the broadcast through the device
source, with FILE GAIN dead and no crossfade.

## Approaches, and the adversarial loop

Five designed, attacked by an independent red team, then the winner attacked again.

| | Approach | Verdict |
|---|---|---|
| A1 | Single-authority `DeckPlayer` class owning both elements, both source ids and the fade FSM | Rejected for now. Built for architectural failure modes the log **excludes**; still misses the empty-queue hole, the transport-strip gating and the now-playing refs; invalidates the tests that would catch its own regressions. Rewriting a 1700-line file that owns the live stream to fix an `if` is how a new failure reaches air. |
| **A2** | **Repair the invariants in place** | **Shipped.** |
| A3 | Delete the two-element crossfade; one element + a 1s gain dip | Rejected. Fixes neither Tier-1 defect, adds an audible load gap on *every* track change (the pre-roll is what hides it), and that gap is invisible in jsdom, so it ships green and broken. Also deletes a feature the host uses. |
| A4 | 1s watchdog that force-corrects desync | Rejected. Circular — during a legitimate fade two decks are legitimately playing, so it must trust `crossfadingRef`, the state it exists to police. Its only correction is silence, on air, unattended. |
| A5 | Element registry + a red STOP ALL FILE AUDIO button | Split. Registry kept as teardown correctness; button dropped (zeroing gains with nothing to re-arm them makes recovery worse, and END BROADCAST already is that button). |

The second round, against A2 itself, changed the design three times:
- **No `src` clearing and no `load()`.** The fix is the *guard*, not the clearing; dropping it also
  avoids interrupting a pending load and needs no new jsdom fake.
- **`src` has exactly one writer** (`loadInto()`), with the loaded id in a `WeakMap` keyed by the
  element. A fourth parallel ref would be the same bug one layer along.
- **An abort must not restart anything,** and must be a no-op when no fade is running, so an
  ordinary queue edit never touches audio.

A third round found two defects in the implementation itself: the FILE fader had to *re-target the
incoming deck* mid-fade rather than set both (setting the outgoing un-muted it, sending both tracks
out loud), and `finalizeCrossfade`'s new cancel branch had to honour an owed advance or the deck
would sit on a finished track in silence.

## What shipped

All in `src/radio/admin/GoLivePanel.tsx`; `localDeck.ts` needed no change (its index arithmetic was
already correct and already tested).

1. `loadedTrackIds` WeakMap + `loadInto()` as the only writer of `el.src`, and `holdsTrack()` as the
   only reader of "what is loaded".
2. Every play path checks it: `handleDeckPlayPause` (replacing `!el.src`), the visibility resume,
   and `finalizeCrossfade`, which refuses to promote the incoming deck unless the track it is
   actually playing (`fadingInIdRef`) is still `deck.next`.
3. `abortCrossfade()` — cancels the timer, pauses the incoming deck, mutes it, restores the outgoing
   gain, clears the latch, and reports whether the outgoing track had already ended so the caller
   can finish the move. Wired into remove, REMOVE ALL, shuffle, drag-reorder, jump, **and
   NEXT / PREV / seek**, which were the dead buttons.
4. `dropOrphanedPlayback()` pauses any deck holding a track that just left the queue. REMOVE ALL
   also pauses the alt deck and calls `clearArtwork()` (it was still broadcasting the deleted
   track's art every 4s).
5. `ensureFileElement()` creates the mixer-attached element lazily, so files added after a go-live
   with an empty queue reach the mixer. The unattached mount element is gone. The now-playing UI
   state is written before the element check, so a row click off air still highlights it.
6. `handleGoLive` disconnects the old publisher and calls `teardownMixer()` first. `HostMixer`'s
   source-id counter restarts at 1, so a surviving `altIdRef` of `"2"` would have ramped a
   **different source** in the new mixer — reachable by pressing GO LIVE from the `lost` error
   banner, which does not tear down.
7. The transport strip renders for the whole broadcast instead of only while the queue is non-empty
   (REMOVE ALL used to delete the only PAUSE button from the page), with PREV/NEXT/seek disabled on
   an empty queue. `TransportBtn` gained a `disabled` prop.
8. `onerror` on both decks → stop the disc and surface the file name, instead of silence with the
   disc still spinning.
9. The FILE fader reaches the idle deck too (off-fade), and re-targets the incoming deck over 0.3s
   mid-fade.
10. Teardown and END BROADCAST silence **every element the panel ever created**, via `deckElsRef`.

## Deliberately not fixed here

- **`autoMix` is not persisted** in `hostPrefs` while `crossfadeSec` is, so the host's AUTO-MIX
  choice is forgotten every session. One line, but it is a preference change, not this bug.
- **`PreviewMeter` returns the wrong cleanup** (`GoLivePanel.tsx`, the inner async IIFE's cleanup is
  discarded), leaking a `getUserMedia` stream + an AudioContext per pre-live device change. Real,
  inaudible, unrelated.
- **`micSourceIdRef` is never assigned**, so the `'mic'` branch of `handleTrackGainChange` is dead.
- **`shouldStartCrossfade` fires on remaining ≤ `crossfadeSec`**, so a 12s fade on a shorter track
  (or after a seek into the window) outlives the audio. Quality bug, pre-existing.
- **The ffmpeg exit at 19:07:59.** Restreamer-side, cause unlogged.

## Verification

`npx vitest run` → **67 files, 576 tests** (was 565; +11, all confirmed red against the pre-fix
source before the fix was written). `npm run build` clean. New cases live in
`GoLivePanel.test.tsx` under *"removed tracks must not stay audible"*.

jsdom cannot play audio, so the suite proves the logic, not the sound. The device check is a short
private GO LIVE with the host console plus one `/radio?debug` tab: start a crossfade, REMOVE the
incoming track mid-fade (the removed track must stop, the outgoing must continue at full level, the
queue position must not jump), REMOVE ALL mid-track (sound stops, PAUSE still on screen), re-add one
file and press PLAY (the **new** file plays), then a second run going live with an **empty** queue
and adding a file mid-show (the listener must hear it, with FILE GAIN working).
