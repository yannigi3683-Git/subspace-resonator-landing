# Quick Access Links: QA Report

**Date:** 2026-06-13
**Auditor:** QA Agent (Claude Code)
**Scope:** quick access links feature, code + test inspection, plus build and test run

---

### QA1 - Whole-row links present
**PASS.** Each release with a `url` renders as a single `<a>` covering the row (`SignalLog.tsx`, `LogRow`).

### QA2 - New-tab safety
**PASS.** Links use `target="_blank"` and `rel="noopener noreferrer"`.

### QA3 - Hover / focus affordance
**PASS.** `ArrowUpRight` slides in on `group-hover` and `group-focus-visible`; title shifts to accent color. Transform/opacity only, so no layout shift.

### QA4 - Keyboard focus ring
**PASS.** `focus-visible:ring-1 focus-visible:ring-primary/60` on the row anchor.

### QA5 - release_click GA4 event
**PASS.** `onClick` fires `trackEvent("release_click", { title })` via `src/lib/analytics.ts`, which no-ops safely without gtag.

### QA6 - Non-interactive fallback for url-less rows
**PASS.** A release without a `url` renders as a plain `<div>` (no anchor). Covered by a dedicated test.

### QA7 - Tests green and build clean
**PASS.** `npx vitest run` reports all SignalLog tests passing (added link assertions plus the fallback case); `npm run build` completes cleanly.

---

## Summary

| Total | PASS | FAIL |
|-------|------|------|
| 7 | 7 | 0 |

### Incidental observations

- The feature is GA4-only; no DebugView configuration change is needed. Verify the live event under GA4 Realtime after deploy.
- The `aria-label` uses a comma, not an em dash, in keeping with the project voice rules.
- This feature has no relation to the radio feature; it touches only `SignalLog.tsx`, its test, and the shared analytics wrapper.
