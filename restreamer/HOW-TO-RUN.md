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

## DJ from your phone or another computer

The restreamer PC and the DJ device are separate. Go Live from any device with internet (phone
browser, second laptop) exactly as normal. The restreamer finds your show through Cloudflare and
Supabase by its session id, not by which device you are on. The only rule: this PC must be powered
on and running the black window during the whole show. If it sleeps or shuts off, listeners drop
back to plain WebRTC.

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

## What's in `.env` (already set, never share it)

R2 storage keys, the Supabase service key, and the broker URL. It is gitignored on purpose — it holds
secrets. Do not paste it anywhere.
