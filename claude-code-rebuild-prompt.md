# Claude Code prompt — Subspace Resonator rebuild

> **How to use this file:**
> 1. Open VS Code on your home computer
> 2. Open a new empty folder where you want the project
> 3. Open the terminal in VS Code (Ctrl + ` ) and run: `claude`
> 4. Once Claude Code starts, copy everything below the line and paste it as one message
> 5. Claude Code will scaffold the project, install dependencies, write all files, and run a dev server

---

# 🎯 SUBSPACE RESONATOR — Project Brief

You are building a single-page React website for a Goa & Psychedelic Trance artist named **Subspace Resonator**. This is a production-grade rebuild of an existing Lovable.dev prototype, applying a complete code and design overhaul.

## Tech stack — non-negotiable

- **Vite** with **React 18** + **TypeScript**
- **Tailwind CSS v3** for styling
- **Framer Motion** for animations
- **lucide-react** for icons
- **react-helmet-async** for SEO meta tags
- **@fontsource/space-grotesk**, **@fontsource/inter**, **@fontsource/jetbrains-mono** for self-hosted fonts

Use `pnpm` if available, otherwise `npm`. Scaffold the project with `npm create vite@latest . -- --template react-ts` then install dependencies.

## Setup steps in order

1. Scaffold Vite + React + TS project in current folder
2. Install Tailwind v3 (not v4 — keep `tailwind.config.ts` + `postcss.config.js`)
3. Install all dependencies listed above
3.5. **Copy assets** from the `pictures/` subfolder (already present in the project folder) into `src/assets/` using these exact mappings:

   | Source file in `pictures/`                        | Target in `src/assets/`              |
   |----------------------------------------------------|--------------------------------------|
   | `Logo Hero.jpg`                                    | `bio-watermark.jpg`                  |
   | `20250128-IMG_5732.jpg`                            | `live-alpha.jpg`                     |
   | `Logo Hero.jpg` *(copy again)*                     | `art-subspace-theory.jpg`            |
   | `gallery-1.jpg` … `gallery-23.jpg`                 | `gallery-01.jpg` … `gallery-23.jpg` *(zero-pad the number)* |
   | `label-geomagnetic-official.png`                   | `label-geomagnetic-official.png`     |
   | `label-timewarp-official.png`                      | `label-timewarp-official.png`        |
   | `label-goa-records-official.png`                   | `label-goa-records-official.png`     |
   | `label-spiral-trax-official.png`                   | `label-spiral-trax-official.png`     |
   | `gallery-1.jpg` *(copy to public/)*                | `public/og-image.jpg`                |

   There is no `favicon.svg` in `pictures/` — create a simple SVG placeholder: a dark circle with "SR" in primary blue.

4. Create folder structure (see below)
5. Configure design tokens in `tailwind.config.ts` and `src/index.css`
6. Build each component per specs below
7. Wire up `App.tsx` and `main.tsx`
8. Run `npm run dev` and verify it loads cleanly
   Note: the Vite TS template sets `"strict": true` in `tsconfig.json` — do not remove it. After each component, run `npx tsc --noEmit` to catch type errors early.

---

## 📁 Folder structure

```
subspace-resonator/
├── public/
│   ├── og-image.jpg              (1200x630 social share)
│   └── favicon.svg
├── src/
│   ├── assets/                   (images go here)
│   ├── components/
│   │   ├── SiteHeader.tsx
│   │   ├── HeroSection.tsx
│   │   ├── HeroVisualizer.tsx
│   │   ├── MusicPlayer/
│   │   │   ├── MusicPlayer.tsx
│   │   │   ├── SpectrumAnalyzer.tsx
│   │   │   ├── FloodlightSet.tsx
│   │   │   └── Knob.tsx
│   │   ├── LabelPedigree.tsx
│   │   ├── BioSection.tsx
│   │   ├── BookingSection.tsx
│   │   ├── GallerySection.tsx
│   │   ├── SocialMatrix.tsx
│   │   └── Footer.tsx
│   ├── lib/
│   │   └── siteContent.ts        (centralized content: gallery, etc.)
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   └── vite-env.d.ts
├── tailwind.config.ts
├── postcss.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🎨 Design system — implement these tokens FIRST in `tailwind.config.ts` and `src/index.css`

### Color palette (CSS variables, HSL channels for Tailwind)

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 240 4% 6%;        /* #0E0E10 — was pure black, fixes OLED smear */
    --foreground: 240 5% 95%;       /* #F0F0F2 — main text */
    --muted: 240 4% 12%;            /* surface elevation */
    --muted-foreground: 220 9% 65%; /* #9CA3AF — passes WCAG AAA on dark */
    --primary: 202 100% 61%;        /* #38B6FF — was electric blue, now sharper */
    --primary-foreground: 240 4% 6%;
    --border: 240 4% 18%;
    --card: 240 4% 8%;
    --ring: 202 100% 61%;
  }

  * { @apply border-border; }
  html { scroll-behavior: smooth; }
  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  h1, h2, h3, .display { font-family: 'Space Grotesk', sans-serif; }
  .mono, code, .terminal { font-family: 'JetBrains Mono', monospace; }
}

@layer components {
  .section-border {
    @apply border border-border bg-card/40;
  }
  .nav-link {
    @apply px-3 min-h-[44px] flex items-center text-xs tracking-[0.15em] uppercase text-muted-foreground hover:text-primary transition-colors;
  }
  .glass-header {
    background: hsla(240, 4%, 6%, 0.85);
    backdrop-filter: blur(12px);
    border-bottom: 1px solid hsl(var(--border));
  }
}
```

### Tailwind config — type scale

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1280px' } },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        border: 'hsl(var(--border))',
        card: 'hsl(var(--card))',
        ring: 'hsl(var(--ring))',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.4' }],
        sm: ['14px', { lineHeight: '1.5' }],
        base: ['16px', { lineHeight: '1.6' }],
        lg: ['20px', { lineHeight: '1.4' }],
        xl: ['28px', { lineHeight: '1.2' }],
        '2xl': ['44px', { lineHeight: '1.1' }],
      },
      letterSpacing: {
        tight: '-0.02em',
        wide: '0.08em',
        wider: '0.12em',
        widest: '0.15em',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

**Critical typography rules:**
- Minimum text size anywhere on the page: **12px**
- Body copy: **16px** (never below)
- Letter-spacing maximum on anything under 14px: **0.15em**
- Font weights: **400** (body/labels), **500** (medium emphasis), **700** (h1/h2 display headings only)
- All caps only on labels/buttons, never on paragraphs

### Font loading — in `src/main.tsx`

```ts
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
```

---

## 📐 Page structure & order — `App.tsx`

```tsx
<HelmetProvider>
  <Helmet>{/* see SEO section */}</Helmet>
  <div className="min-h-screen bg-background pb-32 md:pb-24">
    <SiteHeader />
    <main>
      <HeroSection />
      <MusicPlayer />
      <LabelPedigree />
      <BioSection />
      <BookingSection />
      <GallerySection />
      <SocialMatrix />
    </main>
    <Footer />
  </div>
</HelmetProvider>
```

**Section order rationale (do not change):**
1. Hero — first impression + 2 CTAs
2. Music — what they're here for
3. Labels — credibility after the music lands
4. Bio — full story
5. Booking — peak intent moment
6. Gallery — visual reinforcement
7. Social — last stop before footer

There is NO standalone Events/GigManifest section. Live dates pointer is inside Booking (see below).

---

## 🧩 Component specifications

### 1. `SiteHeader.tsx`

```tsx
const navItems = [
  { label: 'MUSIC',   href: '#music'   },
  { label: 'LABELS',  href: '#labels'  },
  { label: 'BIO',     href: '#bio'     },
  { label: 'ARCHIVE', href: '#gallery' },
  { label: 'SOCIAL',  href: '#connect' },
];
```

Requirements:
- Sticky `fixed top-0` with glass-header backdrop blur
- Logo on left (use `bio-watermark.jpg` from assets at h-8 w-8)
- Desktop: nav links + a `BOOK` accent button (border-primary, text-primary) on the right
- Mobile: hamburger menu (use `lucide-react` Menu/X icons) with `aria-expanded` and `aria-controls`
- Mobile menu uses `framer-motion` AnimatePresence height animation
- Use anchor tags (`<a href>`), not `<button onClick>` — browser handles smooth scroll natively
- All touch targets minimum 44x44px

### 2. `HeroSection.tsx`

Layout: vertically centered, full container width.

Content stack (top to bottom):
1. **Visualizer + logo** — `w-56 h-56 md:w-72 md:h-72` (NOT 420px — too big)
   - Inside: animated `HeroVisualizer` SVG behind a static logo `<img>` with `loading="eager"`
2. **Visible H1** — `mt-6 text-xl md:text-2xl font-bold tracking-widest text-center uppercase font-display`
   - Text: "SUBSPACE RESONATOR"
3. **Genre tagline** — `mt-2 text-xs tracking-widest text-muted-foreground uppercase text-center`
   - Text: "Goa Trance · Psychedelic Trance · Tel Aviv"
4. **Two CTAs in a flex-wrap row** — `mt-8 flex gap-4 flex-wrap justify-center`
   - Primary: `BOOK FOR YOUR EVENT` → `#contact`
   - Secondary: `LISTEN` → `#music`
   - Both with `min-h-[44px]`, primary has border-primary text-primary

### 3. `HeroVisualizer.tsx` — separate component

Animated SVG circular waveform pulsing at 140 BPM. **MUST include `prefers-reduced-motion` check** — if user prefers reduced motion, render a static version.

```tsx
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReduced) {
  // render static SVG, no rAF loop
}
```

Use `requestAnimationFrame` with proper cleanup (`cancelAnimationFrame` in useEffect return).

### 4. `MusicPlayer/MusicPlayer.tsx` + sub-components

This is the most complex component. Split into separate files:
- `MusicPlayer.tsx` — main container, SoundCloud Widget API integration, track list
- `SpectrumAnalyzer.tsx` — animated frequency bars
- `FloodlightSet.tsx` — Turbosound speaker cabinet visualization
- `Knob.tsx` — volume knob with keyboard + wheel + drag

**Sub-component visual specs:**

**`SpectrumAnalyzer`:** Row of 32 vertical bars (2px wide, 1px gap, full component width). Heights animate via `requestAnimationFrame` — each bar lerps toward a random target (20%–100%) updated every ~200ms. Color: `hsl(var(--primary))` at full height fading to `hsl(var(--muted-foreground))` at short heights (set via inline style). `prefers-reduced-motion`: render all bars static at 40% height, no rAF loop.

**`FloodlightSet`:** Decorative row of 4 Turbosound-style speaker cabinets rendered in SVG. Each cabinet: rounded rectangle ~60×80px, stroke `hsl(var(--border))`, fill `hsl(var(--muted))`. A centered circle (woofer) pulses `scale(1.0 → 1.04)` on a 428ms CSS `@keyframes` loop (= 140 BPM). `prefers-reduced-motion`: static, no scale animation.

**Critical requirements:**
- **NO hardcoded API keys.** Use SoundCloud Widget iframe API only (no REST). If env var ever needed: `import.meta.env.VITE_SC_CLIENT_ID`
- **Two hidden iframes** for SoundCloud Widget API:
  - Tracks: `https://soundcloud.com/subspaceresonance/tracks`
  - Playlists tab with multiple playlists (see content section)
- **All animations check `prefers-reduced-motion`** — both SpectrumAnalyzer and FloodlightSet
- **Knob component is keyboard accessible:**
  - `role="slider"` with `aria-valuemin/max/now`
  - `onKeyDown` for ArrowUp/ArrowDown (+/- 5)
  - `tabIndex={0}`
- **Progress bar is keyboard accessible:**
  - `role="slider"`, `tabIndex={0}`
  - ArrowLeft/ArrowRight seeks ±10s
- **All transport buttons have `aria-label`**
- **rAF cleanup in every useEffect**
- **Use `useCallback` for handlers** to prevent unnecessary re-renders
- **MOBILE layout (below `md:` — <768px):** Fixed bottom bar, `h-16 w-full z-50 bg-card border-t border-border`. Left: album art `40×40` rounded-sm (fallback: `art-subspace-theory.jpg`). Center: `flex-1 overflow-hidden` — track title `text-sm truncate`, artist `text-xs text-muted-foreground`. Right: play/pause button `44×44` with `aria-label`. No SpectrumAnalyzer, no FloodlightSet, no Knob on mobile. Body needs `pb-16` to prevent content overlap.
- **DESKTOP layout (`md:` and above):** Full-width card, ~200px tall, `p-6`. Three columns: Left `w-48` = FloodlightSet. Center `flex-1` = SpectrumAnalyzer (top 40%) + progress bar + transport controls (bottom 60%). Right `w-64` = TRACKS / PLAYLISTS tab switcher → scrollable track list → Knob at bottom-right.

**Track list filters** — hide these from track view (they belong in DJ SETS playlist only):
- `/return to goa/i`
- `/old school night/i`
- `/al\s*titosh|sukkot\s*2024/i`

**Playlists available:**
```ts
const PLAYLIST_DEFS = [
  { key: '1998-2025',   label: '1998-2025',   url: 'https://soundcloud.com/subspaceresonance/sets/subspace-resonator-1998-2025' },
  { key: 'dj-sets',     label: 'DJ SETS',     url: 'https://soundcloud.com/subspaceresonance/sets/dj-sets' },
  { key: 'geomagnetic', label: 'GEOMAGNETIC', url: 'https://soundcloud.com/subspaceresonance/sets/geomagnetic-label-group' },
];
```

**External streaming links shown below the player:**
- SoundCloud full playlist
- Bandcamp: `https://yannig.bandcamp.com/`
- YouTube: `https://www.youtube.com/@SubspaceResonator`
- Spotify: `https://open.spotify.com/artist/0UQWUdUuQ3NhMCACj4UXlk`
- Discogs: `https://www.discogs.com/artist/15101171-Subspace-Resonator`

### 5. `LabelPedigree.tsx`

```ts
const labels = [
  { name: 'Geomagnetic', url: 'https://geodistro.bandcamp.com/',       releases: 3, years: '2001–2024' },
  { name: 'Timewarp',    url: 'https://timewarprecords.bandcamp.com/', releases: 2, years: '2003–2006' },
  { name: 'Goa Records', url: 'https://goarecords.bandcamp.com/',      releases: 1, years: '2023'      },
  { name: 'Spiral Trax', url: 'https://spiraltrax.bandcamp.com/',      releases: 2, years: '1999–2002' },
];
```

(User will provide actual release counts/years — these are placeholders.)

Layout: 2-column grid mobile, 4-column desktop. Each cell shows:
- Logo (object-contain, aspect-square, `width={120} height={120}` — NOT 1024)
- Label name in uppercase tracking-widest below
- "{releases} releases · {years}" in smaller muted text

All external links: `target="_blank" rel="noopener noreferrer"` + `aria-label` like "Geomagnetic Records on Bandcamp".

Hover state: `border-primary` + subtle `whileHover={{ y: -2 }}` lift.

Section heading: `// RESONANCE NETWORK` in primary color, small tracking-widest, with sub-label "RELEASED ON" below.

### 6. `BioSection.tsx`

Three sub-sections labeled `// THE SIGNAL`, `// THE REACTIVATION`, `// THE MISSION`.

**Copy — use exactly this text:**

THE SIGNAL:
> Emerging from the late '90s Goa Trance movement, Subspace Resonator operated when the underground was a guarded frequency — no stage names, no digital footprints. Active since 1998, with releases on Geomagnetic, Goa Records, Spiral Trax, and Timewarp.

THE REACTIVATION:
> After years of data-gathering, Subspace Resonator returns — fusing primal energy with cutting-edge synthesis and total authenticity. Available as a full live set or DJ set, 60 to 180 minutes. Based in Tel Aviv, touring internationally.

THE MISSION:
> Deliver mind-bending frequencies and direct signal access to new sonic dimensions.

**At the end of the bio**, add a CTA block:

```tsx
<div className="mt-8 flex gap-4 flex-wrap">
  <a href="#contact" className="border border-primary text-primary text-xs tracking-widest uppercase px-6 min-h-[44px] inline-flex items-center hover:bg-primary hover:text-primary-foreground transition-colors">
    BOOK SUBSPACE RESONATOR
  </a>
  <a href="#music" className="text-xs tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors inline-flex items-center min-h-[44px]">
    LISTEN →
  </a>
</div>
```

Background watermark: the section wrapper needs `className="relative ..."`. Inside it, add:
```tsx
<img src={bioWatermark} alt="" aria-hidden="true"
     className="absolute inset-0 w-full h-full object-contain
                opacity-[0.06] pointer-events-none select-none" />
```

### 7. `BookingSection.tsx`

```
// BOOKING - A DIRECT SIGNAL PATH
```

**Section element must have `id="contact"`** — all `#contact` anchor links from Hero, Bio, and Header point here.

Two-column grid (live photo on left, copy on right) on lg+. Single column mobile.

**Copy:**
> Available for festivals, club nights, and private events. Full live set or DJ set, 60 to 180 minutes. Technical rider on request. Direct booking — no agency fees. Based in Tel Aviv, touring internationally.

**LIVE DATES block** — add this above the contact buttons:

```tsx
<div className="mb-6 pb-6 border-b border-border">
  <p className="text-xs tracking-widest text-muted-foreground uppercase mb-3">
    // LIVE DATES
  </p>
  <p className="text-sm text-muted-foreground mb-3">
    Upcoming shows and festival dates posted on Instagram and Facebook.
  </p>
  <div className="flex gap-4">
    <a href="https://www.instagram.com/subspace_resonator" target="_blank" rel="noopener noreferrer"
       className="text-xs tracking-widest uppercase text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1.5 min-h-[44px]">
      ↗ INSTAGRAM
    </a>
    <a href="https://facebook.com/profile.php?id=61559198105695" target="_blank" rel="noopener noreferrer"
       className="text-xs tracking-widest uppercase text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1.5 min-h-[44px]">
      ↗ FACEBOOK
    </a>
  </div>
</div>
```

**Three contact buttons:**
1. `INITIATE CONTACT` → `mailto:subspaceresonator@gmail.com` (primary style)
2. `FAST CHANNEL · CALL` → `tel:+972507974184`
3. `WHATSAPP · CHAT` → `https://wa.me/972507974184` (target="_blank")

All buttons: `min-h-[44px]`, motion.a with `whileHover={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.4)' }}` (use CSS variable, never hardcoded HSL).

Below buttons, show email + phone as muted text for accessibility.

### 8. `GallerySection.tsx`

Auto-scrolling horizontal strip with images. On hover, pause. Click image opens lightbox.

**Requirements:**
- Auto-scroll uses `requestAnimationFrame` with proper cleanup
- **MUST check `prefers-reduced-motion`** — if reduced, no auto-scroll
- Seamless loop via array duplication (`[...images, ...images]`)
- Lightbox uses `framer-motion` AnimatePresence
- **Lightbox accessibility (critical):**
  - `role="dialog"`, `aria-modal="true"`, `aria-label="Image viewer"`
  - Keyboard handlers: Escape closes, ArrowLeft/Right navigate
  - Previous/Next chevron buttons visible inside lightbox (44x44px min)
  - Focus management (no external library needed): on open call `closeButtonRef.current?.focus()`; on close call the stored `triggerRef.current?.focus()` to return focus to the image that was clicked
- Strip images use `loading="lazy"` EXCEPT first 4 which are `loading="eager"`
- Key on duplicated images: `key={`loop-${i}`}` (NOT just `i`)

### 9. `SocialMatrix.tsx`

Grouped into three sections:

```ts
const socialGroups = [
  {
    label: 'STREAM',
    links: [
      { name: 'SoundCloud', url: 'https://soundcloud.com/subspaceresonance' },
      { name: 'Spotify',    url: 'https://open.spotify.com/artist/0UQWUdUuQ3NhMCACj4UXlk' },
      { name: 'Bandcamp',   url: 'https://yannig.bandcamp.com/' },
      { name: 'YouTube',    url: 'https://www.youtube.com/@SubspaceResonator' },
    ],
  },
  {
    label: 'FOLLOW',
    links: [
      { name: 'Instagram', url: 'https://www.instagram.com/subspace_resonator' },
      { name: 'Facebook',  url: 'https://facebook.com/profile.php?id=61559198105695' },
      { name: 'TikTok',    url: 'https://www.tiktok.com/@subspace.resonator' }, /* note: subspace.resonator NOT resonato */
    ],
  },
  {
    label: 'CATALOGUE',
    links: [
      { name: 'Discogs', url: 'https://www.discogs.com/artist/15101171-Subspace-Resonator' },
    ],
  },
];
```

**No Linktree.** **No Events external link** (replaced by anchor to other sections if needed).

Each link: icon + name in a bordered pill, `min-h-[44px]`. Section ID: `id="connect"`.

**Icons** — use `lucide-react` where it fits, text abbreviation for the rest (already in deps):

| Platform   | Icon                                   |
|------------|----------------------------------------|
| SoundCloud | `<Music2 size={14} />`                 |
| Spotify    | `<Music2 size={14} />`                 |
| Bandcamp   | `<Music2 size={14} />`                 |
| YouTube    | `<Youtube size={14} />`               |
| Instagram  | `<Instagram size={14} />`             |
| Facebook   | `<span className="font-mono text-xs">FB</span>` |
| TikTok     | `<span className="font-mono text-xs">TK</span>` |
| Discogs    | `<span className="font-mono text-xs">DC</span>` |

Render icon/abbrev with `className="mr-2"` inside the pill, vertically centered.

### 10. `Footer.tsx`

Simple. Dark border-top. Center-aligned. Two lines:
- `© 2026 SUBSPACE RESONATOR — ALL FREQUENCIES RESERVED` at text-xs muted
- Booking email + phone as clickable mailto/tel links

---

## 🔍 SEO — in `App.tsx` `<Helmet>`

```tsx
<Helmet>
  <title>Subspace Resonator | Goa & Psychedelic Trance</title>
  <meta name="description" content="Subspace Resonator — Goa & psychedelic trance. Stream music, hear the labels, book direct. Based in Tel Aviv, touring internationally." />
  <link rel="canonical" href="https://subspaceresonator.com/" /> {/* update once domain is live */}

  <meta property="og:title" content="Subspace Resonator | Goa & Psychedelic Trance" />
  <meta property="og:description" content="Stream music, see live dates, book direct." />
  <meta property="og:url" content="https://subspaceresonator.com/" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://subspaceresonator.com/og-image.jpg" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="theme-color" content="#0E0E10" />

  <script type="application/ld+json">{JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    'name': 'Subspace Resonator',
    'genre': ['Goa Trance', 'Psychedelic Trance'],
    'foundingDate': '1998',
    'url': 'https://subspaceresonator.com/',
    'sameAs': [
      'https://soundcloud.com/subspaceresonance',
      'https://open.spotify.com/artist/0UQWUdUuQ3NhMCACj4UXlk',
      'https://yannig.bandcamp.com/',
      'https://www.youtube.com/@SubspaceResonator',
      'https://www.instagram.com/subspace_resonator',
      'https://www.discogs.com/artist/15101171-Subspace-Resonator',
    ],
    'contactPoint': {
      '@type': 'ContactPoint',
      'email': 'subspaceresonator@gmail.com',
      'contactType': 'Booking',
    },
  })}</script>
</Helmet>
```

---

## ♿ Accessibility — universal requirements

- **WCAG 2.1 AA minimum** — verify with browser devtools
- Every interactive element: minimum 44x44px touch target
- Every icon-only button: `aria-label`
- Every external link: `rel="noopener noreferrer"`
- Every modal/lightbox: `role="dialog"` + `aria-modal="true"` + keyboard support (Escape closes)
- Every animation: `prefers-reduced-motion` check
- Visible focus ring on all interactive elements (`focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background`)
- Semantic HTML — use `<main>`, `<nav>`, `<section>`, `<header>`, `<footer>`
- One `<h1>` per page (in Hero)

---

## 📦 Assets needed

The user will copy these from their existing Lovable project into `src/assets/`:

| Filename | Used in | Notes |
|----------|---------|-------|
| `bio-watermark.jpg` | Hero, Bio, Header logo | Main brand mark |
| `live-alpha.jpg` | Booking section image | Live performance shot |
| `live-beta.jpg` | (no longer needed) | Was for GigManifest — remove |
| `art-subspace-theory.jpg` | MusicPlayer fallback art | Track artwork fallback |
| `label-geomagnetic-official.png` | LabelPedigree | Label logo |
| `label-timewarp-official.png` | LabelPedigree | Label logo |
| `label-goa-records-official.png` | LabelPedigree | Label logo |
| `label-spiral-trax-official.png` | LabelPedigree | Label logo |
| Gallery images (4-12 photos) | GallerySection | Live shots, studio, art |
| `og-image.jpg` | `/public/` | 1200x630 social share |
| `favicon.svg` | `/public/` | Brand icon |

Define gallery images in `src/lib/siteContent.ts`:

```ts
// src/lib/siteContent.ts
// Uses Vite glob import — build-safe even if file count changes.
const galleryImages = import.meta.glob('../assets/gallery-*.jpg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

export const useGallery = () =>
  Object.entries(galleryImages)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, src], i) => ({
      src,
      alt: `Subspace Resonator — photo ${i + 1}`,
    }));
```

> **Note:** if `src/assets/` has no `gallery-*.jpg` files yet, `useGallery()` returns `[]` safely — no build error.

Configure Vite path alias for `@/` → `src/`:

```ts
// vite.config.ts
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
```

---

## 🚀 Deployment — custom domain

After the dev server runs cleanly:

1. Create a GitHub repo and push the code
2. Connect to **Vercel** (free tier): https://vercel.com/new
3. Vercel auto-detects Vite, deploys on push
4. Buy a domain (Namecheap or Cloudflare) — suggested: `subspaceresonator.com`
5. In Vercel Project Settings → Domains, add the custom domain
6. Follow Vercel's DNS instructions (2 records)
7. Once live, the canonical URL in Helmet should already be correct

---

## ✅ Quality bar — verify before declaring done

- [ ] `npm run dev` starts without errors
- [ ] `npm run build` succeeds without warnings
- [ ] All 9 components render with correct content
- [ ] Hero H1 is visible (not sr-only)
- [ ] BOOK button visible in header on desktop
- [ ] Booking section shows live dates pointer above contact buttons
- [ ] All animations stop when system has prefers-reduced-motion enabled
- [ ] Lightbox closes on Escape key
- [ ] No hardcoded API keys anywhere in code
- [ ] Lighthouse score: Performance > 90, Accessibility > 95, SEO > 95
- [ ] Site is readable on a phone outdoors (dark grey not pure black, larger text, sharper blue)
- [ ] All external links open in new tabs with security attributes
- [ ] Mobile menu opens/closes correctly with aria-expanded toggling

---

## 🎯 Execute now

Start by:
1. Confirm you understand the brief (one sentence is enough)
2. Scaffold the project
3. Install dependencies
4. Set up design tokens
5. Build components in this order: SiteHeader → HeroSection → MusicPlayer → LabelPedigree → BioSection → BookingSection → GallerySection → SocialMatrix → Footer → App.tsx wiring
6. Run dev server and report any issues

After each component is built, run `npm run build` to catch type errors early. Don't write all components then build at the end.

When stuck on visual details (sizing, exact spacing, hover states), prefer the existing visual language: dark sci-fi underground, terminal-style `//` comments as section labels, monospace for technical labels, primary blue accent used sparingly, all caps with wide tracking for headings only.

You have full creative latitude on the `HeroVisualizer` animation, the gallery layout details, and the music player's vintage hi-fi rack styling — match the brief intent, don't slavishly copy.

Go.
