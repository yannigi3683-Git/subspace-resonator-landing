# Quick Access Links: Clickable Music Archive Rows

**Date:** 2026-06-13
**Priority:** Conversion (route visitors from the Music Archive straight to each release)
**Scope:** Music Archive discography rows (`// MUSIC ARCHIVE` section)
**Files:** `src/components/SignalLog.tsx`, `src/components/SignalLog.test.tsx`
**Status:** Implemented and live

---

## Context

The Music Archive (`SignalLog`) listed each release as static text: date, title, and a meta line (type, label). A visitor who wanted to hear a release had no way to get there from the ledger. Quick access links turn every release row into a single clickable link to that release's page, so a visitor reaches Bandcamp or Spotify in one tap.

This is a presentation + analytics change only. It does not alter the discography data, SEO, or JSON-LD.

---

## Behavior

- **Whole-row link.** Each release with a `url` renders as one `<a>` covering the entire row (date, title, meta), so the whole row is the tap target. Far above the 44px touch-target minimum.
- **New tab, safely.** `target="_blank"` with `rel="noopener noreferrer"`.
- **Screen readers.** `aria-label` of the form `"<title>, open release"`.
- **Hover / focus affordance.** A lucide `ArrowUpRight` icon slides in at the right edge on `group-hover` and `group-focus-visible`; the title shifts to the accent color. Uses transform/opacity only, so there is no layout shift.
- **Keyboard.** Visible focus ring via `focus-visible:ring-1 focus-visible:ring-primary/60`.
- **Graceful fallback.** A release with no `url` renders as a plain non-interactive row (a `<div>`, no anchor). This keeps the type forgiving for any future entry that has no link yet.
- **Analytics.** On click, fires `trackEvent("release_click", { title })` through the existing `src/lib/analytics.ts` wrapper (which no-ops safely when gtag is absent).

---

## Release URL map

| Release | Destination |
|---------|-------------|
| The Subspace Theory | Bandcamp (album) |
| Nightmare In Heaven | Bandcamp (track) |
| Galaxy 604 | Bandcamp (track) |
| Psychedelic Goa Trance 2026: 100 Aliens | Fresh Frequencies Bandcamp (album) |
| The Call Of Goa, Vol. 5 | Timewarp Records Bandcamp (album) |
| Psy Trance 2026: Space DJ | Spotify (album) |

All destinations are Bandcamp except Psy Trance 2026: Space DJ, which uses the one available Spotify album URL.

---

## File summary

| File | Change |
|------|--------|
| `src/components/SignalLog.tsx` | Added optional `url` to the `Release` type; populated the six URLs; split the row into `RowBody` + `LogRow`; `LogRow` renders an `<a>` when `url` is present, else a `<div>`; added the `ArrowUpRight` hover/focus affordance, focus ring, and the `release_click` GA4 event. |
| `src/components/SignalLog.test.tsx` | Added assertions: each release links to its page with `target="_blank"` and a `rel` containing `noopener`; a url-less row renders no anchor. |

---

## Out of scope

- No new GA4 destination configuration; the event reuses the existing `trackEvent` wrapper.
- No row links for unreleased album tracks.
- No change to discography data, SEO meta, or JSON-LD.

---

## Safety notes

- No user-visible copy was added or changed, so no em dashes were introduced.
- Links open in a new tab with `noopener`, so the destination cannot reach back into the page via `window.opener`.
- The url-less fallback means a missing link can never produce a broken anchor.
