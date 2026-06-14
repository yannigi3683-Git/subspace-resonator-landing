# Speakers + Spectrum at md Breakpoint: QA Report

**Date:** 2026-06-14
**Auditor:** Claude Code (Opus 4.8)
**Branch:** `feat/md-speakers-spectrum`
**Scope:** Reveal the `FloodlightSet` speakers (L/R) and `SpectrumAnalyzer` meters (CH-L/CH-R) on the bottom rack at the **md** breakpoint (768-1023px), where previously they only appeared at **lg** (>=1024px). Code + test inspection, full test run, production build, and live multi-width visual verification.

---

## What changed

Three Tailwind class edits in `src/components/MusicPlayer/MusicPlayer.tsx`, no logic touched:

| Element | Before | After |
|---------|--------|-------|
| Speaker, left (`FloodlightSet side="left"`) | `hidden lg:block` | `hidden md:block` |
| Speaker, right (`FloodlightSet side="right"`) | `hidden lg:block` | `hidden md:block` |
| Spectrum meters (`SpectrumAnalyzer` CH-L / CH-R wrapper) | `hidden lg:flex` | `hidden md:flex` |

Deliberately **unchanged**: the decorative `1/0` patch-bay label stays `hidden lg:flex` (adds width, no value at md); row gap stays `gap-2` at md.

---

## How to reproduce this test (the procedure)

Run from project root. Every step must pass before this change is allowed to merge to `master` (master auto-deploys to production).

```
npm test          # full vitest suite, must be 66/66 (or higher) green, 0 failing
npm run build     # tsc -b && vite build, must exit 0 with no TS errors
npm run dev       # then visually inspect the bottom rack at the widths below
```

**Visual procedure (dev server at localhost:5173):** size the browser to each width and confirm the bottom rack against the checks. Automated capture used headless Chromium at viewport heights of 700px, clipping the bottom 170px. Screenshots retained during review at 768 / 900 / 1023px.

---

## Checks performed

### QA1 - Speakers visible at md
**PASS.** Both `FloodlightSet` cabinets (TF-L, TF-R) render across 768-1023px. Confirmed live at 768, 900, 1023px.

### QA2 - Spectrum meters visible at md
**PASS.** Both `SpectrumAnalyzer` columns (CH-L, CH-R) render across 768-1023px. They use the component's built-in compact size (`h-14`, `w-[3px]` bars) below lg, so no new sizing was required.

### QA3 - No horizontal overflow / no sideways scroll
**PASS.** Every element in the rack row is `shrink-0` except the track-info block, which is `flex-1 min-w-0`. The track-info block absorbs all width pressure, so the bar never exceeds viewport width. Verified: no horizontal scrollbar at 768px, the tightest case.

### QA4 - Title degrades gracefully (truncates, never clips the layout)
**PASS.** At 768px the title truncates to `Nightmare In Heaven (...`; at 900px `...timewarp309 - Timewa...`; at 1023px the full `Nightmare In Heaven (timewarp309 - Timewarp)`. Ellipsis via existing `truncate`; no overlap with neighbors.

### QA5 - lg layout unchanged
**PASS.** At >=1024px the rack is identical to before (speakers + meters + larger spectrum + `1/0` label all still present). The change only lowers the floor; it does not alter lg.

### QA6 - Mobile (<768px) unchanged
**PASS.** The mobile bottom bar (`md:hidden`) is untouched; the desktop rack (`hidden md:block`) remains hidden below md. No regression to the phone layout.

### QA7 - Symmetry / stereo metaphor intact
**PASS.** Left speaker + meters + right speaker mirror correctly. No asymmetric/half-rendered state at any width in the md range.

### QA8 - Tests green and build clean
**PASS.** `npm test` -> 18 files, 66 tests passing, 0 failing. `npm run build` -> exit 0, no TypeScript errors (the >500kB chunk warning is pre-existing and unrelated).

---

## Pre-Production Gate (must be all-checked before merge to master)

> master auto-deploys to production on push. Treat merge as "ship." Do not check a box you have not personally verified.

- [ ] `npm test` is fully green (no `.only`, no skipped tests masking a failure)
- [ ] `npm run build` exits 0 with no new TypeScript errors
- [ ] `npm run lint` is clean (note: eslint was not installed in the dev environment at the time of this report, so lint could not be run here; the change is className-string-only with no lint-relevant logic. Run it in CI / a fresh `npm ci` before relying on this box.)
- [ ] Visually verified the bottom rack at **768px** (no overflow, title truncates)
- [ ] Visually verified at **900px** and **1023px** (comfortable, symmetric)
- [ ] Verified **lg (>=1024px)** is visually unchanged from production
- [ ] Verified **mobile (<768px)** bar is unchanged (no desktop rack leaking in)
- [ ] No em dashes introduced in any user-visible copy (project voice rule)
- [ ] Diff touches **only** `MusicPlayer.tsx` (+ this QA doc) - no unrelated files
- [ ] Confirmed work is committed on the feature branch, not directly on master
- [ ] PR opened and reviewed before merge

### Post-deploy verification (after the PR merges and Vercel ships)

- [ ] Confirm the deploy actually shipped: `curl -s "https://subspaceresonator.com/?cb=$(date +%s)" | grep -c "og:"` returns ~12 (not 0 = stale build)
- [ ] On a real or emulated tablet (~768-1023px), load the live site and confirm speakers + meters appear on the bottom rack
- [ ] Confirm phone view still shows the compact mobile bar

---

## Summary

| Total checks | PASS | FAIL |
|--------------|------|------|
| 8 | 8 | 0 |

### Incidental observations (out of scope, not fixed here)

- The `CH-L` / `CH-R` labels render twice under each meter (the `SpectrumAnalyzer` prints its own label span, and the rack adds a housing label box). This is **pre-existing lg behavior**, now mirrored at md. Candidate for a separate small cleanup; not a regression from this change.
- Spectrum bars animate only while audio is playing; when paused they decay to static segments. Screenshots were captured paused, which still proves the layout fit (the goal of this test).
- This change is unrelated to the radio feature; it touches only `MusicPlayer.tsx` and this report.
