# Subspace Radio — How many listeners, and how to host 100+

Plain-language guide. No jargon. Read top to bottom.

## The short version

- **The audio relay (Cloudflare) is NOT the limit.** It can carry hundreds of listeners on the
  free plan. Bandwidth only. You will not hit its ceiling at 100 people.
- **The limit is Supabase** — the service that handles login, chat, and the "who's here" list.
- Every listener who taps **TUNE IN** does a quiet, invisible **guest login**. Supabase's free
  plan caps guest logins at **30 per hour** by default. That is the wall.
- On the night this was diagnosed, ~18 people were in and 17+ were turned away. 18 + 17 ≈ 35
  guest logins in the hour — over the 30 cap. That is exactly what a full cap looks like.

This is the thing half-remembered as *"if I make a real user I get more capacity, mine is a test
one."* The "test user" is the **guest login**, and it is what's capped.

## The fix — DONE, confirmed 2026-07-30

The cap is already raised. Checked in the dashboard: **"Rate limit for anonymous users" = 300
requests/h**, up from the default 30. Nothing to do here unless someone changes it back.

To re-check it, or after any Supabase plan change:
[Rate Limits for this project](https://supabase.com/dashboard/project/lgcmbmlapksmdbkhkyyv/auth/rate-limits).
Sitting alongside it, also confirmed healthy: token refreshes at 150 per 5 min per IP (1800/hour),
so that is not a second bottleneck.

**The number is per hour PER IP ADDRESS, not per project.** This matters more than the number:

- Listeners on their own phones and home networks each get their own 300/hour. Effectively
  unlimited for any crowd you will draw.
- A room of people on ONE shared wifi (a venue, a party, a campus) all spend from a single
  300/hour bucket. That is still 10x the old 30, which is what produced the wall below.
- Your own broadcast PC shares its budget with everyone else in the house.

## What the code change does (already shipped on this branch)

Two supporting fixes were made in the code so the dashboard change lands cleanly and so this is
never a mystery again:

1. **Less load on Supabase.** The server used to re-check each listener's login on *every* step of
   connecting. It now remembers a listener's login for 60 seconds, so it asks Supabase about half
   as often. (`api/rtc-session.ts`)
2. **Clear reason on rejection.** If someone is ever turned away again, the server log now says
   **why** — `rate_limited` (the cap is full → raise it) versus a genuine bad login. And the
   listener sees a calm "Room is busy right now, wait a moment and tap TUNE IN again" instead of a
   scary error. (`api/rtc-session.ts`, `src/radio/components/EntryGate.tsx`)

## Proving it before a real gig

Before trusting 100 people live, run the load test:

```
node scripts/radio-loadtest.mjs <preview-or-prod-url> 120
```

It fakes ~120 listeners tuning in at once against a **preview** URL and reports how many got in.
Run it AFTER raising the dashboard cap. If it still rejects people, the next lever is Supabase
**Pro (~$25/month)** for higher chat/presence throughput — decide from the test numbers, not
upfront.

## If you ever need thousands (not now)

There's a bigger, already-built option: the **HLS restream** (proven on a real phone 2026-07-05).
One host stream fans out through a CDN — no per-listener login, no per-listener relay. It scales to
thousands AND fixes the phone-screen-lock audio drop. It's a larger job to finish and ship; pick it
up when a genuinely big event is booked.
