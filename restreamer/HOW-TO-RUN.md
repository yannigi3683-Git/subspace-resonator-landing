# Running the Subspace Radio restreamer (deep-buffer HLS)

This little program gives listeners the smooth, deep-buffer stream that survives weak signal and a
phone screen-lock. It runs on **your PC** while you DJ. When it is off, the radio still works exactly
as before (plain WebRTC) — the site is unchanged until this is running.

## Every show (the routine)

1. **Double-click `start-restreamer.bat`.** A black window opens and stays open. Leave it open.
2. **Go Live** in the host console, exactly as always.
3. Watch the **DEEP BUFFER** badge next to ON AIR in the console. It goes amber `STARTING`, then
   green `ON` about 30 seconds after Go Live. Green is the deep-buffer stream turning on.
   - The black window prints `streamUrl published: ...` at the same moment, if you are at that PC.
     The badge says the same thing from any device, which is the point.
4. **Now send the guest link.** Guests get instant sound and then upgrade to the deep buffer on their
   own.
   - A guest who was already waiting in the link before step 3 upgrades automatically too now.
5. When the show is over: **End Broadcast**, then **close the black window**.

### What the DEEP BUFFER badge means

| Badge | Meaning | What to do |
|---|---|---|
| grey `OFF` | No restreamer stream is advertised. Listeners are on plain WebRTC. | Normal if you chose not to run it. Otherwise the PC is off, asleep, or the window was never opened. |
| amber `STARTING` | The stream exists but nothing proves it is still being written yet. | Wait. Normally ~30s after Go Live. |
| green `ON` | Listeners are getting the deep buffer. | **Send the guest link.** |
| amber `STALLED` | The stream stopped being produced. The restreamer PC died, slept, or was closed. | Nothing to do live — listeners fall back to plain WebRTC by themselves. Check the PC after. |

The badge does not just check that an address exists. It re-reads the stream index every 10 seconds
and checks it is still moving, so a PC that loses power cannot leave a green light over a dead
stream. Frozen for 15 seconds reads as `STALLED`.

## DJ from your phone or another computer

The restreamer PC and the DJ device are separate. Go Live from any device with internet (phone
browser, second laptop) exactly as normal. The restreamer finds your show through Cloudflare and
Supabase by its session id, not by which device you are on. The only rule: this PC must be powered
on and running the black window during the whole show. If it sleeps or shuts off, listeners drop
back to plain WebRTC.

**There is no remote start.** The window has to be opened on that PC by hand. Remote desktop is not
a good workaround on a shared PC: Windows only lets one person be on the screen at a time, so
connecting to your own user bumps whoever else is using the machine to the lock screen.

## Moving it to another computer

Nothing in this program is tied to one machine. It uses no sound card and no local recording, so any
Windows PC that stays awake with internet can run it.

**First, check you actually need to.** If you only want to DJ from a different computer, you do not
have to move anything. Open the console on the new computer, Go Live, and leave the black window
running on this PC exactly as it is (see the section above). Move the program only when you want to
stop depending on this PC at all.

### The one thing people get wrong

Copying the folder is most of the job, but not all of it. Two programs the restreamer needs live
**outside** the folder, so they do not travel with it:

- **Node.js**, which runs the code.
- **ffmpeg**, which converts the audio.

Without both installed, double-clicking `start-restreamer.bat` on the new computer just flashes a
window and dies.

### Steps

1. On the new computer, click Start, type `PowerShell`, press Enter. A blue window opens.
2. Type this and press Enter. Click Yes if Windows asks permission.
   ```
   winget install OpenJS.NodeJS.LTS
   ```
3. Type this and press Enter.
   ```
   winget install Gyan.FFmpeg
   ```
4. **Close the blue window and open a fresh one.** Windows only notices newly installed programs in
   a new window. Skipping this makes the next step look like the install failed when it worked fine.
5. Type this and press Enter:
   ```
   where.exe ffmpeg
   ```
   It prints a line ending in `ffmpeg.exe`. Write that line down, step 8 needs it.
6. Copy this whole `restreamer` folder to a USB stick, then paste it on the new computer somewhere
   simple like `C:\restreamer`. Avoid Documents or OneDrive: folder-syncing software fights with the
   temporary files the restreamer creates.
7. There is **no install step**. The folder already contains everything else it needs (none of it is
   Windows-specific or machine-specific), so you do not need to run `npm install`.
8. Open `.env` in the copied folder (right-click, Open with, Notepad). Find the line starting
   `FFMPEG_PATH=` and replace everything after the `=` with the path from step 5. Use forward
   slashes and keep it on one line. **Change nothing else in that file.** Every other value is a web
   address or a key and is already correct. Save and close.
9. Test it before you rely on it. In the blue window:
   ```
   cd C:\restreamer
   npm run selfcheck
   ```
   It makes a test tone, runs it through the real converter, then fetches it back and checks it plays.
   It needs no broadcast and no internet. You want the last line to say `SELF-CHECK GREEN`. Anything
   else means stop and fix it before a show.
10. Set the new computer to never sleep while plugged in: Settings, System, Power, Screen and sleep,
    "When plugged in, put my device to sleep after" = Never.
11. **Close the black window on this PC.** See the warning below.

After that, every show is the same routine as always: double-click `start-restreamer.bat` on the new
computer, Go Live from wherever you DJ, wait for the DEEP BUFFER badge to go green, send the link.

### Only ever run ONE copy

Do not leave the black window open on two computers at once. Two copies both send audio to the same
place and overwrite each other's files, so your listeners get broken sound. Nothing on screen warns
you, on either machine. There is no protection against this built in, so it is on you to remember.

One black window, on one computer, always. This is the same rule as the Task Scheduler note at the
bottom of this file, and it applies across two PCs in exactly the same way.

### Keep the keys safe

`.env` holds the master keys to the database and the file storage. Copying the folder copies that
file too, which is the point, but it means:

- Move it by hand on a USB stick. Never by email, never pasted into a chat, never committed to git.
- **Delete the copy from the USB stick** once the new computer has it. A forgotten stick in a drawer
  is a spare set of your production keys.
- Only put it on a computer you control, not one an untrusted person uses.
- If that computer is ever lost, sold, or given away, change the Supabase secret key and the R2
  access key.

## Sharing the PC with someone else

The restreamer touches **no audio device** — it downloads the show from Cloudflare and uploads it
again. So when you DJ from another machine, it does not care who is using the desk PC.

| They do | Effect on your stream |
|---|---|
| Switch user / fast user switching | **Safe.** Your session keeps running in the background. |
| Lock the screen (Win+L) | **Safe.** |
| Sign your user out | Kills it. Windows ends every program in your session. |
| Shut down or restart | Kills it. Windows warns *"Someone else is still using this PC"* — clicking through kills it. |
| Let it sleep or hibernate | Kills it. |

This is different from broadcasting *from* that PC. When Voicemeeter on the desk PC feeds the show,
switching users silently mutes it, because Windows hands the sound card to whoever is now on screen.
That trap does not apply when you DJ from another machine.

So the working routine on a shared PC: **start it, switch user, leave.** In every "kills it" case
above your listeners are not left in silence — they fall back to plain WebRTC on their own, and the
badge shows `STALLED`.

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
  and then goes quiet. That is normal. Sound stops within a second, but the console waits about 25
  seconds before it accepts the connection is really gone. Once your internet is back the console
  reconnects **by itself** and the restreamer picks the show back up. Nothing to press.
  - Your listeners keep their name, their avatar and the whole chat through all of it. The
    broadcast is never restarted, only its connection.
  - Only if the console shows a red **"Connection lost"** after your internet is back does it need
    you: press GO LIVE. That is still safe, and listeners still keep everything.
- **`temp dir left behind (harmless)`** in the log is exactly what it says. Windows would not let the
  restreamer delete its scratch folder yet. The next start cleans it up. Ignore it.

## What's in `.env` (already set, never share it)

R2 storage keys, the Supabase service key, and the broker URL. It is gitignored on purpose — it holds
secrets. Do not paste it anywhere.

---

## Optional: run it without a window

**Not set up. Follow this only if you want it.** Today the restreamer needs you to be logged in and
to double-click the batch file. Windows can instead run it as a background task, which:

- needs **no login** — it runs even when the PC sits at the lock screen,
- **survives** someone else taking the PC as their own user,
- **survives** you signing out,
- still dies on shutdown, sleep, or hibernate.

The trade-off: **there is no window at all**, so the DEEP BUFFER badge becomes your only signal.

### Steps

1. Open **Task Scheduler** (press Start, type `Task Scheduler`).
2. **Create Task…** (not "Create Basic Task"). Name it `Subspace Radio Restreamer`.
3. On the **General** tab, choose **"Run whether user is logged on or not"**. It will ask for your
   Windows password when you save.
4. On the **Triggers** tab: **New… → Begin the task: At startup**.
5. On the **Actions** tab: **New…**
   - **Program/script:** the full path to `node.exe`. Find it by opening a Command Prompt and running
     `where node`.
   - **Add arguments:** `--env-file=.env src/index.mjs`
   - **Start in:** the full path to this `restreamer` folder. This one is required — without it Node
     cannot find `.env` or `src/index.mjs`.
6. On the **Conditions** tab, untick **"Start the task only if the computer is on AC power"** if this
   is a laptop you want it to run on regardless.
7. Save, then reboot to confirm it comes up on its own.

`FFMPEG_PATH` in `.env` is already a full path, so ffmpeg is found without relying on your PATH.

To check it is running: Task Manager → Details → look for `node.exe`. To stop it: Task Scheduler →
right-click the task → End, or Disable so it stops starting again.

**Do not run this task and the batch file at the same time.** Two restreamers would fight over the
same network port and overwrite each other's audio files, which breaks the stream for listeners with
nothing on screen explaining why. Pick one.
