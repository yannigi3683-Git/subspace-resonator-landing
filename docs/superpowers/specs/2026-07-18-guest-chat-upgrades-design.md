# Guest Chat Platform Upgrades — Design

**Date:** 2026-07-18
**Branch:** `feat/chat-upgrades`
**Status:** emoji + reply + reactions implemented (held on branch). GIFs DEFERRED —
Google shut down the Tenor API 2026-06-30 (signups closed 2026-01-13); the Tenor build was
removed. See "GIFs (deferred)" below.

## Context

The `/radio` guest chat was a flat, text-only feed: each message a denormalized
snapshot inserted straight into Supabase `chat_messages`, streamed back via Realtime
`postgres_changes`, rendered as escaped React text. No threading, media, emoji
affordance, or reactions. Goal: make the guest chat feel like a real platform for a
live psytrance broadcast, without touching the (frozen) audio path.

## Features

1. **Emoji picker ("computer mode")** — desktop has no emoji key. Smile-button popover,
   curated grid (`emojiSet.ts`), caret insertion. No schema, no dependency.
2. **Reply with quoted stub** — tap Reply on a message; composer shows a chip; the reply
   renders a denormalized quoted stub. Columns `reply_to_id/name/body` (no join, survives
   the 100-message client window).
3. **Reactions** — `chat_reactions` table, own `postgres_changes` channel (INSERT+DELETE),
   count pills under each message, `aggregateReactions` tally. Gate `reaction_allowed()`
   = ban + station-live (no slow-mode).
4. **GIFs (deferred)** — was built on Tenor (server proxy + `contentfilter=high` + host
   allowlist), then removed when Google discontinued the Tenor API (2026-06-30). The
   `gif_url` column remains as a **latent** field in `chat_messages` (Tenor-host CHECK still
   present, nothing writes it) so a provider can be re-wired without a DB migration.
   Re-enable path: **Klipy** is the near-drop-in ex-Tenor replacement
   (`GET https://api.klipy.com/api/v1/{KEY}/gifs/search?q=&per_page=&rating=g`, key in path,
   safe content via `rating=g`); Giphy is the alternative but needs production approval.
   Re-add a server proxy, a `GifPicker`, a client `isAllowedGifUrl` locked to the new
   provider's image CDN, update the DB CHECK host, and keep the bandwidth caps.

## Security

- Message body stays escaped text (React) — no `dangerouslySetInnerHTML` anywhere.
- Reactions/replies inherit the existing `chat_insert` ban/lock/slow-mode RLS model
  (`reaction_allowed()` for reactions: ban + station-live, no slow-mode).
- GIFs (when re-enabled) are the only `<img>` path and MUST be host-allowlisted at **two**
  layers — DB CHECK on `gif_url` + a client URL-parsed host guard — plus a server-side safe
  content filter. Never trust one layer alone.

## Audio safety

None of the code touches the FROZEN audio files (`publisher.ts`, `subscriber.ts`,
`useListenerAudio.ts`, `iceServers.ts`, jitter buffer). Chat + reactions ride Supabase;
audio rides the Cloudflare SFU.

## Files (shipped scope)

- New: `src/radio/emojiSet.ts`, `src/radio/hooks/useReactions.ts`.
- Changed: `src/radio/types.ts`, `src/radio/chatRules.ts` (+ tests),
  `src/radio/hooks/useChat.ts`, `src/radio/components/Chat.tsx` (+ tests),
  `src/radio/components/ChatInput.tsx`, `src/radio/components/LiveRoom.tsx`,
  `supabase/radio-schema.sql`.
- Removed (GIF deferral): `api/tenor-search.ts`, `src/radio/components/GifPicker.tsx`,
  `isAllowedGifUrl`, and all GIF UI/fetch. `gif_url` column + type field kept as latent.

## Deploy prerequisites

1. Apply the updated `supabase/radio-schema.sql` to project `lgcmbmlapksmdbkhkyyv` (it is
   idempotent) BEFORE merging — adds reply columns, `chat_reactions`, `reaction_allowed()`,
   the latent `gif_url` column, RLS, and realtime publication. **DONE 2026-07-18.**
2. `master` auto-deploys — merge only with explicit approval.
3. GIFs: no prerequisite (deferred). Wire a provider later per "GIFs (deferred)" above.

## Verification

Local: `npx vitest run` (360 pass) + `npm run build` clean. Live two-browser host+guest
test (per the plan file): emoji insert, reply (including scroll-out of the quoted stub),
reactions (live add/remove via realtime), and host-delete moderation cascade.
