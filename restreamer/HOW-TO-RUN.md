# Running the Subspace Radio restreamer (deep-buffer HLS)

This little program gives listeners the smooth, deep-buffer stream that survives weak signal and a
phone screen-lock. It runs on **your PC** while you DJ. When it is off, the radio still works exactly
as before (plain WebRTC) — the site is unchanged until this is running.

## Every show (the routine)

1. **Double-click `start-restreamer.bat`.** A black window opens and stays open. Leave it open.
2. **Go Live** in the host console, exactly as always.
3. Watch the black window until it prints **`streamUrl published: ...`** (about 30 seconds after Go
   Live). That is the deep-buffer stream turning on.
4. **Now send the guest link.** Guests get instant sound and then upgrade to the deep buffer on their
   own.
   - A guest who was already waiting in the link before step 3 upgrades automatically too now.
5. When the show is over: **End Broadcast**, then **close the black window**.

## Good to know

- **You can use the PC normally** while the window is open. It sips a little CPU, nothing more.
- **If it crashes**, the window restarts it by itself in 3 seconds. Just leave it open.
- **Set Windows Sleep to Never** (while plugged in) so the PC doesn't nap mid-show:
  Settings → System → Power → Screen and sleep → "When plugged in, put my device to sleep after" =
  Never.
- **If your PC dies mid-show**, listeners drop back to plain WebRTC on their own (they keep hearing
  audio, just without the deep buffer) — they are never left in silence.
- **Instant off switch:** closing the window clears the stream; everyone is back on plain WebRTC with
  no site change.
- **If your internet drops mid-show**, the window logs `ffmpeg exited 0 - will restart on next poll`
  and then goes quiet for up to a minute. That is normal. Your browser needs about 25 seconds to
  notice the drop and reconnect, and the restreamer picks the show back up on its own once it does.
  Since 2026-07-26 that reconnect no longer restarts the broadcast, so listeners keep their name and
  their chat. Nothing to do but wait.
- **`temp dir left behind (harmless)`** in the log is exactly what it says. Windows would not let the
  restreamer delete its scratch folder yet. The next start cleans it up. Ignore it.

## What's in `.env` (already set, never share it)

R2 storage keys, the Supabase service key, and the broker URL. It is gitignored on purpose — it holds
secrets. Do not paste it anywhere.
