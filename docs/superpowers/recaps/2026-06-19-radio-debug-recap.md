# Recap — Getting Subspace Radio On Air (2026-06-19)

Goal at start: GO LIVE on the host console did nothing (403s, then hangs). Goal at end: host
broadcasts and a listener hears audio, end to end, on preview `feat/radio-room`.

## The core insight

A browser → serverless API → **Cloudflare SFU** + **Supabase (RLS)** live-audio room fails in
**layers**. Each layer has a *different* symptom; fixing one reveals the next. The whole session
was peeling these off, top down, using the live server log (`npx vercel logs <url> --json`) as the
source of truth — the client UI only ever showed generic messages.

## The layers we fixed, in order

| # | Symptom | Root cause | Fix | Commit |
|---|---------|-----------|-----|--------|
| 0 | "fix isn't working" | Testing a **stale preview URL** (old bundle hash) | Always verify the **served bundle hash** vs the latest deploy | (process) |
| 1 | Endless `CONNECTING…`, 403 loop | Publisher retried fatal 403/401 forever | Surface fatal errors immediately (`onFatal`) | `457e62e` |
| 2 | 403 `not_admin` (row existed!) | `user_roles` has **RLS enabled, no SELECT policy**; the server key doesn't bypass RLS, so the direct read returned empty | Read role via the **`security definer` `has_role()` RPC** (bypasses RLS regardless of key) | `3f7cf75` |
| 3 | 502 `cf_error` | Wrong **Cloudflare SFU request shapes**: `/sessions/new` must have **no body** (empty `{}` → 400); `/tracks/new` needs a **top-level `sessionDescription`** + each local track's **`mid`** | Corrected both shapes; added `firstMid()` | `bef1fe1` |
| 4 | "Failed to update station" 403 | Browser client wasn't satisfying the `station` write policy | Move go-live/end **station writes server-side**, using a Supabase client scoped to the admin's **validated JWT** (`global.headers.Authorization`) | `0b6f39d` |
| 5 | `CONNECTING…` hang again | Postgres **`42501 permission denied for table station`** — table-level **GRANT** missing | `grant select, update on public.station to authenticated` (+ `select` to anon). **RLS policies are necessary but NOT sufficient.** | (SQL) |
| 6 | Host ON AIR, listener silent | `useListenerAudio` (the subscribe/playback hook) was **never called** by any component — dead code | Wire it into `LiveRoom`; add **TAP TO LISTEN** to defeat autoplay blocking | `d61b1a3` |
| 7 | Host `LISTENERS: 0` | Admin counted presence on a **different channel** (`admin-presence-count`) than listeners (`room:main`) | Observe presence on `room:main` | `92fe320` |

## Diagnostic techniques that paid off

- **`npx vercel logs <deployment-url> --json`** — the exact Postgres `code`/`hint` (e.g. `42501`
  with "GRANT …") and the CF validation body came from here, not the UI.
- **Read public keys from the deployed JS bundle** — Vercel marks env vars *Sensitive*, so
  `vercel env pull` returns them **empty**; the anon key is baked into the client bundle and can
  be extracted to probe the live DB (RLS behaviour, `has_role` callability).
- **Bundle-hash comparison** — `curl <url>/radio.html | grep radio-*.js` vs the latest deploy
  proved "stale tab" several times (the error text is identical across versions, so the screen
  looks the same).
- **Distinguish 403 causes** — return a `reason` from the server so the client says *which* check
  failed (`not_aal2` vs `not_admin`) instead of a generic message.

## Still open (see the polish plan)
Chat GRANT, audio dropouts (bitrate/network), CONNECTING-hang surfacing, host player
(playlist/skip/seek/crossfade), real avatars, listener/UI polish, then merge to production.

## One-line lesson
**When a server-side Supabase read/write fails but the row/permission "looks right" in the SQL
editor, it's almost always (a) RLS-with-no-policy, (b) a non-service key that doesn't bypass RLS,
or (c) a missing table GRANT — and the deployment you're testing may be stale. Check the live log
and the served bundle before touching code.**
