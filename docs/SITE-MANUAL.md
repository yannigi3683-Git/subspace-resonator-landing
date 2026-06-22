# Subspace Resonator — Site Owner Manual

How to update your own site. Each section tells you which file to edit and exactly what to change.

After any change: `git add <file> && git commit -m "your message" && git push` — the site auto-deploys in ~30 seconds.

---

## Add a New Release to the Discography

File: `src/components/SignalLog.tsx`

**Solo release (your own EP/single):** add to `SOLO_RELEASES` array at the top:
```ts
{ date: "2026.MM.DD", title: "Track Title", meta: "Single · Label Name" },
```
Use `"2026"` for year-only dates. Use `"EP · N Tracks · Label"` format for EPs.

**Compilation appearance:** add to `COMPILATION_APPEARANCES` array:
```ts
{ date: "2026.MM.DD", title: "Compilation Name", meta: '"Your Track" · Label Name' },
```

Also update the JSON-LD structured data in `src/App.tsx` (the second `@graph` block) to match — Google uses that for search results.

---

## Update Gallery Photos

Files: `src/assets/gallery-01.webp` through `gallery-23.webp`

**Replace a photo:**
1. Convert your JPG to WebP (use [squoosh.app](https://squoosh.app) — WebP, quality 82)
2. Save it as the same filename (e.g. `gallery-07.webp`) in `src/assets/`
3. That's it — no code changes needed

**Add a new photo:**
1. Convert to WebP, name it `gallery-24.webp` (next in sequence)
2. Save to `src/assets/`
3. Open `src/components/GallerySection.tsx`
4. Find the `import gallery23` line and add below it:
   ```ts
   import gallery24 from '@/assets/gallery-24.webp';
   ```
5. Find the `const images = [` array and add `gallery24` to the list

**Remove a photo:** delete its import line and remove it from the `images` array in `GallerySection.tsx`.

---

## Update Bio Text

File: `src/components/BioSection.tsx`

Three text blocks: Signal (main paragraph), Reactivation (return to scene), Mission (artistic intent). Edit the text directly. No em dashes — use periods or commas instead.

---

## Update Booking Contact Info

**Email or phone** appear in two places — update both:

1. `src/components/BookingSection.tsx` — the button `href` values and the displayed text
2. `src/App.tsx` — the `<footer>` at the bottom of the file (email link and phone link)

Also update `contactPoint.email` in the first JSON-LD block in `src/App.tsx`.

---

## Update Social Links

File: `src/components/SocialMatrix.tsx`

Find the `const socials = [` array. Each entry has `name` and `url`. Change the `url` value.

Also update the `sameAs` array in the first JSON-LD block in `src/App.tsx` — Google uses this to link your profiles.

---

## Update Live Events Link

File: `src/components/SocialMatrix.tsx`

Find `{ icon: CalendarIcon, name: "Live Events", url: "..." }` and change the URL.

---

## Update Label Logos

Files: `src/assets/label-goa.png`, `label-timewarp.png`, `label-geomagnetic.png`, `label-spiraltrax.png`

Replace the PNG file with a new one using the same filename. Keep it transparent background, same proportions if possible.

---

## Add a Gigs / Upcoming Shows Section

This section does not exist yet on the site. To add it, ask Claude Code to build a `GigsSection` component. It would sit between `<BookingSection />` and `<GallerySection />` in `src/App.tsx`. A simple version could be a list of dates, venues, and ticket links — you'd update `src/components/GigsSection.tsx` each time you have a new show.

---

## Update the OG / Social Preview Image

File: `public/og-image.jpg`

Replace the file. Must be 1200×630px, JPEG. This is what shows when someone shares your link on Facebook, WhatsApp, etc. After replacing, go to [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) and click "Scrape Again" to clear Facebook's cache.

---

## Update the Site Description / Title

File: `src/App.tsx` (the `<Helmet>` block near the top)

Edit the `<title>` and `<meta name="description">` values. Also update the `og:title`, `og:description`, `twitter:title`, and `twitter:description` meta tags below — they should match.

Also update the static fallback in `index.html` (same `<title>` and description `<meta>` near the top of that file) — this is what WhatsApp and LinkedIn see.

---

## Deploy After Changes

```
git add src/components/SignalLog.tsx
git commit -m "discography: add [title]"
git push
```

The site auto-deploys to production in about 30 seconds. Verify at [subspaceresonator.com](https://subspaceresonator.com/).

**Check a deploy shipped:**
```
curl -s "https://subspaceresonator.com/?cb=123" | grep -c "og:"
```
Should return `12`. If it returns `0`, the deploy hasn't landed yet — wait 30 more seconds and retry.

---

## After Each Deploy (SEO)

1. Open `public/sitemap.xml`, update `<lastmod>` to today's date
2. Go to [Google Search Console](https://search.google.com/search-console) → Sitemaps → Resubmit
3. Run [Google Rich Results Test](https://search.google.com/test/rich-results) on the live URL

---

## Site Safety and Security (Owner's Chapter)

### How to think about it
You are protecting four things: the site staying up, the radio station staying yours, your music, and your accounts. Your realistic adversaries are bots and bored trolls, not nation states. The architecture handles the bots; this chapter is the part only you can do.

### Where your music lives
In the radio's current design: nowhere but your own device. You press GO LIVE and your sound streams out; when you stop, nothing remains in the cloud. Masters never leave your machine.

### What protects you automatically
The site is static files on a global CDN, so there is no server of yours to crash. The database refuses every write that does not come from your logged-in account, enforced inside the database itself. Going on air requires your password AND your authenticator app. Joining the radio room silently solves an invisible bot test, so scripted flood attacks get expensive while humans notice nothing. Chat is displayed as plain text, so pasted code does not run. Secret keys live only on the servers, never in the page.

### What only you can do (the part that actually gets people hacked)
Real-world attacks on artists are almost never clever code. They are a stolen password or a fake email.

- Turn on two-factor authentication (MFA) on GitHub, Vercel, Supabase, Cloudflare, and Google. Today, not at launch.
- Use a unique password for each, stored in a password manager. Your GitHub account deploys straight to production; treat it like the master key to the studio.
- Be paranoid about emails claiming to be from these services. Log in by typing the address yourself, never through the email's link.
- Never paste a key or password into chat, a DM, or a screenshot.

### Your weapons during a broadcast (all work from your phone)
Slow mode (one message per few seconds), room lock (nobody new can talk), kick, ban, and the kill switch: END BROADCAST and the room goes dark. Raid in progress: lock first, ban second, OFF if it keeps coming.

### Honest limits, accepted on purpose
A funded, determined flood attack can knock the free-tier room offline for the duration of the attack; the answer at $0/month is recovery, not prevention: lock, go dark, return. Anyone who can hear your stream can record it; that is true of Spotify too, and the most they can capture is the live stream quality, never a master. A banned troll with enough patience can return with a fresh browser; the lock exists for exactly that night. A 48-hour marathon means your machine stays on, awake, plugged in, and connected the whole time, and uses about 6-7 GB of upload data (mind 4G data caps).

### When something goes wrong
| Situation | Action |
|---|---|
| Spam raid | Room lock + slow mode (from your phone) |
| Raid will not stop | END BROADCAST. The room goes dark. |
| Flood attack on the site itself | Vercel dashboard → enable Attack Challenge Mode (one toggle; turn off after) |
| Password possibly leaked | Supabase dashboard → revoke sessions → change password. The attacker still lacks your authenticator app. |
| Site looks wrong after a deploy | Vercel → rollback to previous deployment, instant |

An uptime monitor emails you if the site goes down, so you find out before the fans do. Everything needed to rebuild from zero lives in the repo plus the originals on your computer. Back those up like the masters they are.
