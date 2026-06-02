# Subspace Resonator — Website Build Design

**Date:** 2026-06-02
**Status:** Approved
**Spec source:** `claude-code-rebuild-prompt.md` (reviewed + 13 fixes applied)

---

## What we're building

A single-page artist website for Subspace Resonator, a Goa & Psychedelic Trance act based in Tel Aviv. Production-grade rebuild of an existing Lovable.dev prototype. The site must work on mobile (Hebrew keyboard users) and desktop, meet WCAG 2.1 AA, and score Lighthouse ≥90/95/95 (Perf/A11y/SEO).

---

## Tech stack (locked)

| Layer | Choice | Notes |
|-------|--------|-------|
| Build | Vite + React 18 + TypeScript strict | `npm create vite@latest . -- --template react-ts` |
| Styling | Tailwind CSS v3 JIT | `tailwind.config.ts` + `postcss.config.js` (NOT v4) |
| Animation | Framer Motion | AnimatePresence, motion.a, whileHover |
| Icons | lucide-react | Music2, Youtube, Instagram + text abbrev for FB/TK/DC |
| SEO | react-helmet-async | HelmetProvider in App.tsx |
| Fonts | @fontsource (self-hosted) | Inter 400/500, Space Grotesk 500/700, JetBrains Mono 400 |
| Testing | Vitest + React Testing Library | Co-located `*.test.tsx` per component |

---

## Design system

### Colors (CSS variables, HSL channels)

```css
--background: 240 4% 6%       /* #0E0E10 */
--foreground: 240 5% 95%
--muted: 240 4% 12%
--muted-foreground: 220 9% 65%
--primary: 202 100% 61%       /* #38B6FF — electric blue, use sparingly */
--primary-foreground: 240 4% 6%
--border: 240 4% 18%
--card: 240 4% 8%
```

### Typography

- Font weights: **400** (body/labels), **500** (medium), **700** (h1/h2 display only)
- Min text size: 12px. Body: 16px.
- Letter-spacing max on <14px text: 0.15em
- All-caps only on labels/buttons — never paragraphs
- Visual language: dark sci-fi underground, `//` comment-style section labels in mono, primary blue used sparingly

### Visual identity rules (brand-guidelines)

- Section labels: `// SECTION NAME` in `font-mono text-primary text-xs tracking-widest`
- Headings: all-caps Space Grotesk 700 with `tracking-widest`
- Interactive hover: `border-primary` + subtle Framer `whileHover={{ y: -2 }}`
- Glow on CTAs: `whileHover={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.4)' }}`
- Never use hardcoded HSL values — always use CSS variables

---

## Page structure (section order is fixed)

```
SiteHeader (sticky)
main:
  HeroSection          (no section id needed — hero is first)
  MusicPlayer          id="music"    ← nav "MUSIC" + Hero "LISTEN →" CTA
  LabelPedigree        id="labels"   ← nav "LABELS"
  BioSection           id="bio"      ← nav "BIO"
  BookingSection       id="contact"  ← nav "BOOK", Hero "BOOK FOR YOUR EVENT", Bio CTA
  GallerySection       id="gallery"  ← nav "ARCHIVE"
  SocialMatrix         id="connect"  ← nav "SOCIAL"
Footer
```

**Every section component must apply its `id` to the outermost `<section>` element.** All 6 ids are required for smooth-scroll navigation to work.

---

## Build strategy: parallel subagents (Strategy B)

### Phase 1 — Foundation (sequential, one agent)

One agent completes all of this before parallel wave begins:

1. Scaffold project: `npm create vite@latest . -- --template react-ts`
2. Install deps: `tailwindcss@^3 postcss autoprefixer framer-motion lucide-react react-helmet-async @fontsource/inter @fontsource/space-grotesk @fontsource/jetbrains-mono`
3. Install dev deps: `vitest @testing-library/react @testing-library/jest-dom jsdom @types/node`
4. Copy assets from `pictures/` → `src/assets/` per mapping table in spec step 3.5
5. Write `tailwind.config.ts` — full color/font/spacing token system
6. Write `postcss.config.js`
7. Write `src/index.css` — CSS variables, base layer, component layer
8. Write `src/main.tsx` — font imports, StrictMode render
9. Write `vite.config.ts` — `@/` alias, `@vitejs/plugin-react`
10. Write `src/lib/siteContent.ts` — `import.meta.glob` gallery export
11. Configure Vitest in `vite.config.ts` (`test: { environment: 'jsdom', setupFiles: [...] }`)
12. Verify: `npm run build` passes + `npx tsc --noEmit` clean

**Gate:** Phase 2 does NOT start until Phase 1 passes both checks.

### Phase 2 — Parallel component wave (5 agents simultaneously)

Each agent: **write test first → implement → pass test → `tsc --noEmit` clean**.

| Agent | Owns | Key requirements |
|-------|------|-----------------|
| **A1** | `SiteHeader.tsx` | Glass blur, hamburger + `aria-expanded`, BOOK button, `<a href>` anchors (no onClick) |
| **A2** | `LabelPedigree.tsx` + `Footer.tsx` | **`id="labels"`** on section, 4-col grid, actual label logo imgs, copyright line |
| **A3** | `BioSection.tsx` + `BookingSection.tsx` | **`id="bio"`** on BioSection, **`id="contact"`** on BookingSection, bio watermark `opacity-[0.06]`, LIVE DATES block, 3 contact buttons |
| **A4** | `SocialMatrix.tsx` | **`id="connect"`**, lucide icons + FB/TK/DC text abbrev, bordered pills |
| **A5** | `HeroSection.tsx` + `HeroVisualizer.tsx` | H1 `text-xl md:text-2xl`, 140 BPM SVG circular waveform, `prefers-reduced-motion` static fallback |

**Minimum test coverage per component:**
- Renders without crashing (smoke test)
- Key `aria-*` attributes present
- `prefers-reduced-motion` path renders static version (for animated components)
- Interactive elements have min 44px touch targets verified via computed style

### Phase 3 — Assembly (one agent, after Phase 2 complete)

1. `MusicPlayer/MusicPlayer.tsx` — SoundCloud Widget iframe API, track list + filters, tab switcher
2. `MusicPlayer/SpectrumAnalyzer.tsx` — 32-bar rAF animation, reduced-motion static
3. `MusicPlayer/FloodlightSet.tsx` — 4-cabinet SVG, 428ms CSS keyframe pulse
4. `MusicPlayer/Knob.tsx` — role=slider, keyboard + wheel + drag
5. `GallerySection.tsx` — auto-scroll rAF, lightbox with Escape/arrow keys, focus management
6. `App.tsx` — HelmetProvider, all sections in order, SEO Helmet block, JSON-LD schema
7. `public/favicon.svg` — inline SVG: dark circle `#0E0E10`, "SR" text in `#38B6FF`
8. Final `npm run build` — must be warning-free
9. `npx vitest run` — all tests pass

---

## Permissions setup (fewer-permission-prompts)

Configure `.claude/settings.json` in project folder before any agent runs:
- Allow: `npm install *`, `npm run build`, `npm run dev`, `npx tsc --noEmit`, `npx vitest *`, `mkdir -p src/**`, file read/write in project folder

---

## Quality gates

| Gate | When | Tool |
|------|------|------|
| TypeScript strict | After each component | `npx tsc --noEmit` |
| Unit tests | After each component | `npx vitest run` |
| Full build | End of Phase 2 + Phase 3 | `npm run build` |
| Code review | After Phase 3 complete | `/code-review` medium effort |
| Manual checklist | Final | Per spec quality bar (14 items) |

---

## Assets mapping

| pictures/ source | src/assets/ target |
|------------------|--------------------|
| `Logo Hero.jpg` | `bio-watermark.jpg` |
| `20250128-IMG_5732.jpg` | `live-alpha.jpg` |
| `Logo Hero.jpg` *(copy)* | `art-subspace-theory.jpg` |
| `gallery-1.jpg` … `gallery-23.jpg` | `gallery-01.jpg` … `gallery-23.jpg` |
| `label-geomagnetic-official.png` | `label-geomagnetic-official.png` |
| `label-timewarp-official.png` | `label-timewarp-official.png` |
| `label-goa-records-official.png` | `label-goa-records-official.png` |
| `label-spiral-trax-official.png` | `label-spiral-trax-official.png` |
| `gallery-1.jpg` *(public copy)* | `public/og-image.jpg` |

---

## Out of scope for this build

- Backend / API / database
- Authentication
- CMS
- Deployment (README instructions provided, user triggers deploy)
- Events calendar (spec explicitly excludes standalone events section)
- Analytics beyond web-vitals console logging
