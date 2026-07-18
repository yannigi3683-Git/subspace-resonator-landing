# Guest Chat Platform Upgrades — Design

**Date:** 2026-07-18
**Branch:** `feat/chat-upgrades`
**Status:** implemented (held on branch, not yet merged/deployed)

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
4. **GIFs** — Tenor via server proxy `api/tenor-search.ts` (key server-side,
   `contentfilter=high`, `tinygif`/`nanogif` only, `limit=12`). `gif_url` column with a
   Tenor-host DB CHECK; client guard `isAllowedGifUrl` mirrors it.

## Security

- Message body stays escaped text (React). GIFs are the only `<img>` path. Host allowlist
  enforced at **two** layers — DB CHECK on `gif_url` + client `isAllowedGifUrl` (URL-parsed,
  rejects lookalike hosts and js/data schemes). Never trust one alone.
- Tenor `contentfilter=high` forced server-side (cannot be bypassed by the client).
- Reactions/replies inherit the existing `chat_insert` ban/lock/slow-mode RLS model.

## Bandwidth / audio safety

None of the code touches the FROZEN audio files (`publisher.ts`, `subscriber.ts`,
`useListenerAudio.ts`, `iceServers.ts`, jitter buffer). Chat + reactions ride Supabase;
audio rides the Cloudflare SFU. GIF weight is capped (tiny formats, 12 results, lazy
images, 300ms debounce) so image fetches never compete with the audio stream.

## Files

- New: `src/radio/emojiSet.ts`, `src/radio/hooks/useReactions.ts`,
  `src/radio/components/GifPicker.tsx`, `api/tenor-search.ts`.
- Changed: `src/radio/types.ts`, `src/radio/chatRules.ts` (+ tests),
  `src/radio/hooks/useChat.ts`, `src/radio/components/Chat.tsx` (+ tests),
  `src/radio/components/ChatInput.tsx`, `src/radio/components/LiveRoom.tsx`,
  `supabase/radio-schema.sql`.

## Deploy prerequisites

1. Register a Tenor API key (tenor.com/gifapi); set `TENOR_API_KEY` in Vercel (all envs,
   non-sensitive).
2. Apply the updated `supabase/radio-schema.sql` to project `lgcmbmlapksmdbkhkyyv` (it is
   idempotent) BEFORE the code that reads the new columns goes live.
3. `master` auto-deploys — merge only with explicit approval.

## Verification

See the end-to-end steps in the plan file (`plan-in-guest-platform-reflective-leaf.md`):
two-browser host+guest test of emoji, reply (including scroll-out of the stub), reactions
(live add/remove), GIF (post + non-Tenor fallback), and moderation cascade.
