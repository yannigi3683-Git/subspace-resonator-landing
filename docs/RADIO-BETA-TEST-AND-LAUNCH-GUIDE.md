# Subspace Radio - Beta Test & Launch Guide

This is your guide as the owner and host of Subspace Radio.  
It covers everything in order: from first test to going live on your real website.  
Written for you specifically - no assumed technical knowledge.

---

## What you are testing

You built a live internet radio station at subspaceresonator.com/radio.  
You (the host) go to a secret admin page, log in, and click GO LIVE.  
Your audio - from Traktor, from files on your computer, or from a mic - streams live to anyone who opens the page.  
Listeners join with a nickname and avatar, they hear you, and they chat.

Before it goes live on your real website, you test it on a **preview URL** - a private copy of the site that only you know the address of. Same code, same database, no public exposure.

---

## PHASE 0 - One-time setup (do this before anything else)

### 0A - Get your preview URL (2 minutes)

1. Open this link in your browser: **https://github.com/yannigi3683-Git/subspace-resonator-landing/pull/4**
2. Scroll down past all the text until you see a comment from **Vercel** (a bot).
3. It will say something like "Preview deployment ready" with a button or link.
4. Click that link. It opens a URL that looks like: `https://subspace-resonator-landing-xyz123.vercel.app`
5. Write it down or bookmark it. This is your beta URL for all testing. Do not share it.

> **If you don't see a Vercel comment yet:** Wait 2 minutes and refresh the GitHub page. The build takes about 2 minutes after you first open it.

### 0B - Confirm your login credentials (2 minutes)

You need two things to log into the host console:

- **Your Supabase email and password** - the email and password you used when you signed up at supabase.com. This is different from your Google or GitHub login.
- **Your authenticator app code** - a 6-digit number that changes every 30 seconds, from the Google Authenticator or Authy app on your phone. You set this up when you enrolled MFA on your Supabase host account.

> **If you are unsure about your Supabase password:** Go to supabase.com, click Sign In, use "Forgot password" to reset it.  
> **If you never set up the authenticator app:** This was a required step in the RADIO-SETUP.md guide. Contact setup support before continuing.

### 0C - Choose your audio source for this test

You have three options. Pick ONE to start with:

| Option | What you need | Best for |
|--------|--------------|----------|
| **Mic** | Nothing extra - just your built-in microphone | First test in 5 minutes |
| **Local files** | Audio files (MP3, WAV, FLAC) on your computer | Test without Traktor |
| **Traktor / Rekordbox** | Virtual audio cable software (free, 5 min install) | Real DJ set |

**For your very first test, start with Mic.** It requires nothing. Once you confirm the whole system works, switch to Traktor.

**If you want to test with Traktor now, first do step 0D, then come back here.**

### 0D - Set up Traktor audio routing (skip this if testing with mic or files)

Traktor cannot send audio directly to a browser. You need a free piece of software called a "virtual audio cable" that makes Traktor's output look like a microphone input to your browser.

**On Mac:**
1. Go to existential.audio/blackhole and download BlackHole 2ch (free).
2. Run the installer. No restart needed.
3. In Traktor: go to Preferences > Audio Setup. Set "Audio Device" to "BlackHole 2ch". Set "Output Routing" so Master L/R goes to channels 1/2 of BlackHole.
4. Done. When you open the host console later, "BlackHole 2ch" will appear in the AUDIO INPUT dropdown.

**On Windows:**
1. Go to vb-audio.com/Cable and download VB-Cable (free).
2. Run the installer. Restart your computer when prompted.
3. In Traktor: go to Preferences > Audio Setup. Set "Audio Device" to "CABLE Input (VB-Audio Virtual Cable)". Set Master L/R output to CABLE.
4. Done. When you open the host console later, "CABLE Output" will appear in the AUDIO INPUT dropdown.

> **Test the routing works:** Play a track in Traktor. Open your system's sound settings and look at input levels - you should see the level meter moving on BlackHole or CABLE Output when music plays.

---

## PHASE 1 - First test: you host, one listener tab (15 minutes)

This is your first end-to-end test. You will be in two browser tabs at the same time - one as the host, one as a listener. You are testing that the whole chain works.

### Step 1 - Open the host console

1. Open your beta URL in a browser tab.
2. Add `#admin` to the end of the URL in the address bar. Example: `https://subspace-resonator-landing-xyz123.vercel.app/radio#admin`
3. Press Enter.

**What you will see:** A login screen with two fields: email and password.

### Step 2 - Log in (password)

1. Type your Supabase email address.
2. Type your Supabase password.
3. Click the login button (or press Enter).

**What you will see next:** A second screen asking for a 6-digit code.

### Step 3 - Log in (authenticator code)

1. Open Google Authenticator or Authy on your phone.
2. Find the entry for Supabase (it will show a 6-digit number counting down).
3. Type that number into the field on screen.
4. Click Verify (or press Enter).

> **Important:** The code changes every 30 seconds. If the countdown is almost at zero, wait for the next code before typing.

**What you will see:** The HOST CONSOLE. It has three tabs at the top: BROADCAST, SCHEDULE, MODERATION. You are on BROADCAST.

### Step 4 - Understand the BROADCAST tab

Here is what you see and what each thing does:

```
// BROADCAST CONTROL

BROADCAST TITLE [text field]
   - What listeners see above the dancefloor. Example: "Goa Session June 2026"
   - Leave blank and it defaults to "Subspace Radio Live"

AUDIO INPUT (YOUR MICROPHONE, OR TRAKTOR / REKORDBOX VIRTUAL DEVICE)
   - The FIRST time, this shows an [ENABLE AUDIO ACCESS] button.
     Click it and allow the browser's microphone prompt. Browsers hide
     device names until you allow this once - that is why the list looks
     empty before you click it.
   - After that it becomes a dropdown listing all your audio inputs:
     - For mic test: select "Built-in Microphone" or "Default"
     - For Traktor: select "BlackHole 2ch" (Mac) or "CABLE Output" (Windows)
   GAIN [slider 0-200%]
   - How loud this source is in the stream. Leave at 100% to start.

FILE DECK
   ADD FILES [button]
   - Click to pick audio files from your computer
   - They queue up and play through the stream
   - Only appears/matters if you add files
   FILE GAIN [slider]
   - How loud the file deck is. Leave at 100%.

[GO LIVE button]
```

### Step 5 - Set up your first broadcast

For a mic test:
1. In BROADCAST TITLE, type: `Test broadcast - Phase 1`
2. Click **ENABLE AUDIO ACCESS** and allow the browser's microphone prompt. The dropdown now fills with your device names.
3. In AUDIO INPUT, select your built-in microphone. On Mac it usually says "Built-in Microphone". On Windows it usually says "Microphone (Realtek)" or similar.
4. Leave GAIN at 100%.
5. Do not add any files.

For a Traktor test (only if you completed step 0D):
1. In BROADCAST TITLE, type: `Test broadcast - Traktor`
2. Start playing music in Traktor now.
3. Click **ENABLE AUDIO ACCESS** and allow the microphone prompt, so device names appear.
4. In AUDIO INPUT, select "BlackHole 2ch" (Mac) or "CABLE Output" (Windows).
5. Leave GAIN at 100%.

### Step 6 - Go live

1. Click the **GO LIVE** button.
2. Your browser may ask for microphone permission. Click Allow.
3. The button will say **CONNECTING...** for about 3-5 seconds.
4. Then the button changes to **END BROADCAST** (red border) and you see **ON AIR** pulsing in the top right.
5. An **OUTPUT LEVEL** bar appears. Talk into the mic (or play a track) and watch it move - that confirms your sound is actually going out. If it never moves, your input is silent: check you picked the right device and that GAIN is not at 0%.

**You are now broadcasting.**

> **If you see an error message instead:** Read the message carefully. Common issues:
> - "Could not start broadcast" - your browser did not get permission to use the microphone. Check your browser's permission settings.
> - "Failed to update station" - Supabase connection issue. Check that your Vercel env vars are set correctly (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY).
> - Any other message - write it down and report it.

### Step 7 - Open a listener tab

1. Open a **new browser tab**.
2. Go to your beta URL **without** `#admin`. Example: `https://subspace-resonator-landing-xyz123.vercel.app/radio`

**What you will see:** The entry gate. It shows "SUBSPACE RADIO LIVE" at the top, a grid of 12 coloured circles (the avatars), a name field with a random name already filled in, and a TUNE IN button.

### Step 8 - Join as a listener

1. Click any coloured circle to select your avatar. It gets a white ring around it when selected.
2. The name field has a random name (like "NebulaDrifter"). You can change it or leave it.
3. The TUNE IN button will enable itself automatically after a few seconds (it's running an invisible security check).
4. Click **TUNE IN**.

**What you will see:** The dancefloor. Background is a dark photo of a live show. Your avatar dot appears somewhere in the crowd area. At the top it shows "SUBSPACE RADIO LIVE" and the broadcast title you typed.

**What you will hear:** Your mic (or Traktor) audio within 1-2 seconds.

> **If you hear nothing on desktop:** Look for a volume control in the top of the page. Try clicking anywhere on the page first - browsers sometimes require a click before playing audio.  
> **If you hear nothing on mobile:** Tap anywhere on the screen. iOS requires a user tap to unlock audio playback.

### Step 9 - Verify the listener count

Go back to your host console tab (the one with END BROADCAST).  
Look for **LISTENERS: 1** near the bottom of the broadcast panel.  
This confirms the listener connection is live and being counted.

### Step 10 - Test chat

In the listener tab:
1. Look at the right side of the screen - there is a chat panel.
2. Click the text input at the bottom (it says something like "Type a message...").
3. Type: `hello from listener`
4. Press Enter or click the send button.

You should see your message appear in the chat list with your avatar colour and name.

In the host console tab:
- The host console does not show the chat currently (that is the MODERATION tab, coming in M8). But the message is in the database and visible to all listeners.

Open a third browser tab, join as a second listener, and you will see the message in chat there.

### Step 11 - End the broadcast

Go to your host console tab.  
Click **END BROADCAST**.  
It will say "ENDING..." for a moment.  
The button returns to GO LIVE.

**What the listener tab sees:** The dancefloor disappears. The standby screen appears: "SUBSPACE RADIO LIVE" and "SIGNAL OFFLINE".

Phase 1 complete. You have confirmed the full chain works.

---

## PHASE 2 - Traktor / Rekordbox test (30 minutes)

Only start this phase after Phase 1 passes. Skip if you already tested with Traktor in Phase 1.

**Prerequisite:** Complete step 0D (virtual cable setup) before continuing.

### Step 1 - Start Traktor and play a track

1. Open Traktor.
2. Load a track and start it playing.
3. Confirm you can hear it through your speakers or headphones (it should be routing normally).
4. Check your system input levels - the virtual cable input should be showing signal.

### Step 2 - Go live with Traktor audio

Follow the same steps as Phase 1, but in Step 5:
- Select "BlackHole 2ch" (Mac) or "CABLE Output" (Windows) from the AUDIO INPUT dropdown.

Click GO LIVE.

### Step 3 - Verify audio quality in the listener tab

Open your beta URL in a new tab and join as a listener (same as Phase 1, Step 7-8).

What to check:
- [ ] You hear the music from Traktor - same track, no delay more than 2 seconds.
- [ ] The audio is stereo (music sounds full, not mono/thin).
- [ ] No clicks, pops, or distortion.
- [ ] If you fade Traktor's master volume down, the stream volume goes down. If you fade it up, the stream volume goes up.

### Step 4 - Test a track transition

While live, transition to a second track in Traktor as you normally would during a set. The stream should carry the transition without cutting out.

### Step 5 - Test the GAIN slider in the host console

In the host console, drag the GAIN slider next to the AUDIO INPUT dropdown:
- Drag left (toward 0%) - listener hears it get quieter.
- Drag right (toward 200%) - listener hears it get louder (be careful, 200% can distort).
- Return to 100% for normal level.

### Step 6 - End broadcast

Click END BROADCAST. Listener tab shows standby screen.

---

## PHASE 3 - Multi-device test (20 minutes)

Now you test on the actual devices your listeners will use.

### Step 1 - Test on iPhone (Safari)

1. On your iPhone, open Safari.
2. Go to your beta URL.
3. Join as a listener - avatar, name, TUNE IN.
4. **While on WiFi:** confirm you hear the stream within 2 seconds.
5. Send a chat message from the phone.
6. Lock your phone screen. Wait 30 seconds. Unlock it. Check if audio is still playing.

> **Known behaviour:** iOS may pause audio when the screen locks. This is a device limitation. If it stops, the listener needs to tap play again. This will be documented before launch.

### Step 2 - Test on Android (Chrome)

Same steps as iPhone above, using Chrome on an Android device.

### Step 3 - Test on 4G (no WiFi)

On your phone:
1. Turn off WiFi (go to phone Settings > WiFi > Off).
2. Go to your beta URL on 4G/LTE.
3. Join as a listener and confirm audio plays.
4. This confirms the stream works on mobile data, not just home internet.

Turn WiFi back on after this test.

### Step 4 - Test the 4G host scenario

This is critical. Your set may be from a venue where you only have 4G.

1. Turn off WiFi on your computer (or hotspot from your phone).
2. Go to the host console on 4G.
3. Go live with Traktor audio.
4. Open a listener tab on your phone (WiFi is fine for the listener).
5. Confirm the stream plays for at least 5 minutes without dropping.
6. Watch for the audio cutting out and auto-reconnecting.

> **Expected behaviour:** If the connection drops for a moment, the stream will pause for listeners and then resume automatically within a few seconds. This is normal behaviour under network instability.

---

## PHASE 4 - Private rehearsal broadcast (2 hours)

This is the final gate before you go public. No shortcuts.

**What this is:** A real broadcast, running for 2 continuous hours, with at least one real listener who is NOT you, on a real device, ideally on cellular.

**Who to invite:** One or two people you trust - a friend, another producer. Send them the beta URL and tell them to join and stay for the rehearsal.

**What you do during the 2 hours:**
- [ ] Broadcast a real set using Traktor (or your preferred source).
- [ ] Change broadcast title mid-set (you can edit it while live).
- [ ] Send a chat message as the host (join as a listener in another tab, your messages will show with a HOST badge).
- [ ] Ask your listener to send a chat message. Read it.
- [ ] Deliberately end broadcast and restart mid-session. Listener should see standby, then automatically transition back to the room when you go live again.
- [ ] At the 60-minute mark: check LISTENERS count in host console. Still showing correctly?
- [ ] Have your listener try on phone with screen locked for 10 minutes.

**What success looks like:**
- The stream played for 2 hours without a crash or hard stop.
- Your listener heard continuous audio (minus the deliberate restart).
- Chat worked throughout.
- No error messages appeared in the host console.
- Listener count stayed accurate.

**If something fails during Phase 4:** Note what happened, what you were doing at the time, and what you saw on screen. Do not merge to production until the issue is found and fixed.

---

## PHASE 5 - Go live on production (5 minutes)

Only after Phase 4 passes without issues.

**What this does:** Merges your radio feature into the main website. Within 2 minutes it is live at subspaceresonator.com/radio for the whole world.

**This is a one-way door.** Once merged, the radio page is public. You can take it down by rolling back the deployment, but do not merge until you are ready.

### Step 1 - Merge the pull request

1. Go to: **https://github.com/yannigi3683-Git/subspace-resonator-landing/pull/4**
2. Scroll to the bottom.
3. Click **Merge pull request**.
4. Click **Confirm merge**.

### Step 2 - Wait for deployment (2 minutes)

1. Go to: **https://vercel.com** and log in.
2. Find your project "subspace-resonator-landing".
3. Watch the deployment list - a new one will appear with status "Building".
4. Wait for it to say "Ready".

### Step 3 - Verify it is live

Open a new browser tab and go to: **https://subspaceresonator.com/radio**

You should see the entry gate - the same one you tested on the preview URL.

### Step 4 - Test the real production site

Log into the host console at: **https://subspaceresonator.com/radio#admin**

Do a quick 5-minute broadcast to confirm production is working identically to the preview.

### Step 5 - Update the sitemap (SEO)

Open the file `public/sitemap.xml` in the project.  
Change the `lastmod` date to today's date (format: YYYY-MM-DD).  
Commit and push. This tells Google your sitemap was updated.

---

## Quick reference: things to check if something goes wrong

| Problem | What to check |
|---------|--------------|
| Preview URL not found | Wait 2 min, refresh the GitHub PR page, look for Vercel comment |
| Can't log into host console | Check email/password on supabase.com login page. Make sure you're using the right authenticator code (it changes every 30 seconds) |
| GO LIVE shows "CONNECTING..." forever | Check browser console (F12) for errors. Check Cloudflare Realtime credentials in Vercel settings |
| GO LIVE shows "Failed to update station" | Supabase connection issue. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel env vars |
| Listener tab shows standby screen when you're live | The station mode did not flip. Check if the error appeared in host console after clicking GO LIVE |
| No audio in listener tab | Click anywhere on the page first (browser audio unlock). On mobile: tap the screen. Check if GAIN slider is at 0% |
| No audio from Traktor | Check virtual cable routing in Traktor preferences. Check that your system input levels show signal on the virtual cable |
| Listener count shows 0 even with listeners | Presence channel issue. Check Supabase Realtime settings |

---

## Summary: the order of everything

```
Phase 0 - One-time setup
  0A: Get preview URL from GitHub PR #4
  0B: Confirm Supabase login + authenticator app
  0C/0D: Audio setup (mic only, or install virtual cable for Traktor)

Phase 1 - First test (15 min)
  Host console → Log in → Set title → Pick mic → GO LIVE
  New tab → Entry gate → Join → Hear audio → Chat → Listener count = 1
  End broadcast → Listener sees standby

Phase 2 - Traktor test (30 min) - only after Phase 1 passes
  Traktor playing → GO LIVE with virtual cable → Verify quality
  Test transitions, gain slider, end cleanly

Phase 3 - Multi-device test (20 min) - only after Phase 2 passes
  iPhone Safari → Android Chrome → 4G listener → 4G host

Phase 4 - Private rehearsal (2 hours) - only after Phase 3 passes
  Real 2-hour set, real listener on another device, test all features

Phase 5 - Go live on production (5 min) - only after Phase 4 passes
  Merge PR on GitHub → Vercel deploys → Test on real URL → Update sitemap
```
