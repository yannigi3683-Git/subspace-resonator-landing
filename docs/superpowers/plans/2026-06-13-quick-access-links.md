# Quick Access Links: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` to write the tests first, then `superpowers:executing-plans` to work task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each Music Archive release row a clickable link to that release's page, with a hover icon, keyboard focus ring, and a `release_click` GA4 event.

**Architecture:** Single component, `src/components/SignalLog.tsx`. Test-driven: extend `src/components/SignalLog.test.tsx` first. Reuses the existing `trackEvent` wrapper in `src/lib/analytics.ts`.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v3, lucide-react (`ArrowUpRight`). Tests via Vitest.

---

## Task steps

- [ ] **1. Add the `url` field.** Add `url?: string` to the `Release` type and populate the six confirmed URLs (five Bandcamp, one Spotify for Psy Trance 2026: Space DJ).

- [ ] **2. Write the tests first.** In `SignalLog.test.tsx`, assert: the region renders; all six releases render; each release links to its page with `target="_blank"` and a `rel` containing `noopener`; a url-less row renders no anchor.

- [ ] **3. Split the row.** Extract `RowBody` (date + title + meta) and `LogRow`. `LogRow` returns an `<a>` when `url` is present, otherwise a `<div>` (non-interactive fallback).

- [ ] **4. Add the affordance.** Add `ArrowUpRight` (lucide-react) with a `group-hover` / `group-focus-visible` transition (transform + opacity only), the title color shift, and `focus-visible:ring-1 focus-visible:ring-primary/60`.

- [ ] **5. Wire analytics.** `onClick={() => trackEvent("release_click", { title: r.title })}`.

- [ ] **6. Verify.** `npx vitest run` and `npm run build`, both clean.

- [ ] **7. Deploy hygiene.** Bump `public/sitemap.xml` lastmod to the deploy date; commit.

---

## Self-Review Checklist

- [x] Tests cover both linked rows and the non-linked fallback row.
- [x] No em dashes in any copy (no user-visible copy added).
- [x] No SEO meta or JSON-LD touched.
- [x] Analytics no-ops safely in tests (no gtag present).
- [x] New tab uses `rel="noopener noreferrer"`.
