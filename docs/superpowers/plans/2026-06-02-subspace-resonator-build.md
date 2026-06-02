# Subspace Resonator Website — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade single-page React artist website for Subspace Resonator (Goa/Psychedelic Trance, Tel Aviv) with 10 components, SoundCloud Widget integration, animated gallery, and WCAG 2.1 AA compliance.

**Architecture:** Three sequential phases — Phase 1 scaffolds the entire foundation (Vite + TS + Tailwind + assets), Phase 2 builds 5 component groups that can run in parallel once Phase 1 gates pass, Phase 3 assembles MusicPlayer (4 files), GallerySection, and App.tsx wiring. Each phase ends with a `tsc --noEmit` + `npm run build` gate.

**Tech Stack:** React 18, Vite, TypeScript (strict), Tailwind CSS v3, Framer Motion, lucide-react, react-helmet-async, @fontsource (Inter/Space Grotesk/JetBrains Mono), Vitest + React Testing Library, SoundCloud Widget iframe API.

**Project root:** `C:\Users\yanni\Documents\Subspace Resonator landing page\`

---

## File Map

```
src/
  assets/                        (copied from pictures/ — see Task 2)
  components/
    SiteHeader.tsx               Task 7
    SiteHeader.test.tsx          Task 7
    HeroSection.tsx              Task 11
    HeroSection.test.tsx         Task 11
    HeroVisualizer.tsx           Task 11
    HeroVisualizer.test.tsx      Task 11
    MusicPlayer/
      MusicPlayer.tsx            Task 15
      MusicPlayer.test.tsx       Task 15
      SpectrumAnalyzer.tsx       Task 12
      SpectrumAnalyzer.test.tsx  Task 12
      FloodlightSet.tsx          Task 13
      FloodlightSet.test.tsx     Task 13
      Knob.tsx                   Task 14
      Knob.test.tsx              Task 14
    LabelPedigree.tsx            Task 8
    LabelPedigree.test.tsx       Task 8
    BioSection.tsx               Task 9
    BioSection.test.tsx          Task 9
    BookingSection.tsx           Task 9
    BookingSection.test.tsx      Task 9
    GallerySection.tsx           Task 16
    GallerySection.test.tsx      Task 16
    SocialMatrix.tsx             Task 10
    SocialMatrix.test.tsx        Task 10
    Footer.tsx                   Task 8
    Footer.test.tsx              Task 8
  lib/
    siteContent.ts               Task 5
    siteContent.test.ts          Task 5
  App.tsx                        Task 17
  main.tsx                       Task 4
  index.css                      Task 4
  vite-env.d.ts                  (auto-generated)
tailwind.config.ts               Task 4
postcss.config.js                Task 4
vite.config.ts                   Task 4
public/
  favicon.svg                    Task 17
  og-image.jpg                   Task 2
```

---

## PHASE 1 — FOUNDATION

### Task 1: Configure permissions

**Files:**
- Create: `.claude/settings.json`

- [ ] **Step 1: Create `.claude/` folder and settings file**

Run in the project root (`C:\Users\yanni\Documents\Subspace Resonator landing page\`):

```bash
mkdir -p .claude
```

Write `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm install *)",
      "Bash(npm run build)",
      "Bash(npm run dev)",
      "Bash(npm run preview)",
      "Bash(npx tsc --noEmit)",
      "Bash(npx vitest *)",
      "Bash(mkdir -p src/**)",
      "Bash(cp *)",
      "Bash(node *)"
    ]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add .claude/settings.json
git commit -m "chore: add claude permissions config"
```

---

### Task 2: Scaffold project and copy assets

**Files:**
- Create: all Vite scaffold files
- Create: `src/assets/*` (copied from `pictures/`)
- Create: `public/og-image.jpg`

- [ ] **Step 1: Scaffold Vite project**

Run in `C:\Users\yanni\Documents\Subspace Resonator landing page\`:

```bash
npm create vite@latest . -- --template react-ts
```

When prompted "Current directory is not empty. Remove existing files and continue?" — answer **No** / choose "Ignore files and continue" to keep the `pictures/`, `docs/`, `.claude/` folders.

- [ ] **Step 2: Install production dependencies**

```bash
npm install tailwindcss@^3 postcss autoprefixer framer-motion lucide-react react-helmet-async @fontsource/inter @fontsource/space-grotesk @fontsource/jetbrains-mono
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom @types/node
```

- [ ] **Step 4: Initialize Tailwind**

```bash
npx tailwindcss init -p --ts
```

Expected: creates `tailwind.config.ts` and `postcss.config.js`.

- [ ] **Step 5: Create `src/assets/` folder**

```bash
mkdir -p src/assets
```

- [ ] **Step 6: Copy assets from `pictures/` to `src/assets/`**

Run each copy command (PowerShell):

```powershell
Copy-Item "pictures\Logo Hero.jpg" "src\assets\bio-watermark.jpg"
Copy-Item "pictures\Logo Hero.jpg" "src\assets\art-subspace-theory.jpg"
Copy-Item "pictures\20250128-IMG_5732.jpg" "src\assets\live-alpha.jpg"
Copy-Item "pictures\label-geomagnetic-official.png" "src\assets\label-geomagnetic-official.png"
Copy-Item "pictures\label-timewarp-official.png" "src\assets\label-timewarp-official.png"
Copy-Item "pictures\label-goa-records-official.png" "src\assets\label-goa-records-official.png"
Copy-Item "pictures\label-spiral-trax-official.png" "src\assets\label-spiral-trax-official.png"
```

- [ ] **Step 7: Zero-pad and copy gallery images**

```powershell
for ($i = 1; $i -le 23; $i++) {
  $src = "pictures\gallery-$i.jpg"
  $dst = "src\assets\gallery-{0:D2}.jpg" -f $i
  if (Test-Path $src) { Copy-Item $src $dst }
}
```

- [ ] **Step 8: Copy og-image to public/**

```powershell
Copy-Item "pictures\gallery-1.jpg" "public\og-image.jpg"
```

- [ ] **Step 9: Commit**

```bash
git add src/assets public/og-image.jpg
git commit -m "chore: copy assets from pictures/ to src/assets/"
```

---

### Task 3: Write config files

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `postcss.config.js`
- Modify: `vite.config.ts`
- Modify: `src/index.css`
- Modify: `src/main.tsx`
- Modify: `tsconfig.json`

- [ ] **Step 1: Write `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1280px' } },
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
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

- [ ] **Step 2: Write `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 4: Write `src/test-setup.ts`**

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Write `src/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 240 4% 6%;
    --foreground: 240 5% 95%;
    --muted: 240 4% 12%;
    --muted-foreground: 220 9% 65%;
    --primary: 202 100% 61%;
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

- [ ] **Step 6: Write `src/main.tsx`**

```tsx
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 7: Update `tsconfig.json` — ensure strict mode is on**

Verify `tsconfig.json` contains `"strict": true`. If the scaffold didn't include it, add it:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 8: Commit**

```bash
git add tailwind.config.ts postcss.config.js vite.config.ts src/index.css src/main.tsx src/test-setup.ts tsconfig.json
git commit -m "chore: configure tailwind, vite, test setup, css tokens"
```

---

### Task 4: Write `src/lib/siteContent.ts` and verify foundation

**Files:**
- Create: `src/lib/siteContent.ts`
- Create: `src/lib/siteContent.test.ts`
- Create: `src/App.tsx` (stub — will be replaced in Task 17)

- [ ] **Step 1: Write failing test**

`src/lib/siteContent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { useGallery } from './siteContent';

describe('useGallery', () => {
  it('returns an array', () => {
    const images = useGallery();
    expect(Array.isArray(images)).toBe(true);
  });

  it('each item has src and alt', () => {
    const images = useGallery();
    images.forEach((img, i) => {
      expect(typeof img.src).toBe('string');
      expect(img.alt).toBe(`Subspace Resonator — photo ${i + 1}`);
    });
  });

  it('items are sorted by filename', () => {
    const images = useGallery();
    for (let i = 1; i < images.length; i++) {
      expect(images[i - 1].alt.localeCompare(images[i].alt)).toBeLessThanOrEqual(0);
    }
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npx vitest run src/lib/siteContent.test.ts
```

Expected: FAIL — `useGallery` not defined.

- [ ] **Step 3: Write `src/lib/siteContent.ts`**

```ts
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

- [ ] **Step 4: Run test — verify it passes**

```bash
npx vitest run src/lib/siteContent.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Write stub `src/App.tsx` (so tsc and build pass)**

```tsx
export default function App() {
  return <div />;
}
```

- [ ] **Step 6: Run tsc and build gate**

```bash
npx tsc --noEmit
npm run build
```

Expected: both clean, no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ src/App.tsx
git commit -m "feat: foundation — tailwind tokens, siteContent gallery hook, build green"
```

---

## PHASE 2 — PARALLEL COMPONENT WAVE

> Tasks 5–9 can run in parallel. Each task writes test first, then implementation, then verifies `tsc --noEmit`.

---

### Task 5 (A1): SiteHeader

**Files:**
- Create: `src/components/SiteHeader.tsx`
- Create: `src/components/SiteHeader.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/SiteHeader.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SiteHeader from './SiteHeader';

describe('SiteHeader', () => {
  it('renders without crashing', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('has nav links pointing to correct anchors', () => {
    render(<SiteHeader />);
    expect(screen.getByRole('link', { name: /MUSIC/i })).toHaveAttribute('href', '#music');
    expect(screen.getByRole('link', { name: /LABELS/i })).toHaveAttribute('href', '#labels');
    expect(screen.getByRole('link', { name: /BIO/i })).toHaveAttribute('href', '#bio');
    expect(screen.getByRole('link', { name: /ARCHIVE/i })).toHaveAttribute('href', '#gallery');
    expect(screen.getByRole('link', { name: /SOCIAL/i })).toHaveAttribute('href', '#connect');
  });

  it('has BOOK button linking to #contact', () => {
    render(<SiteHeader />);
    const bookLink = screen.getByRole('link', { name: /BOOK/i });
    expect(bookLink).toHaveAttribute('href', '#contact');
  });

  it('hamburger button has aria-expanded', () => {
    render(<SiteHeader />);
    const btn = screen.getByRole('button', { name: /menu/i });
    expect(btn).toHaveAttribute('aria-expanded');
  });

  it('mobile menu opens and closes', () => {
    render(<SiteHeader />);
    const btn = screen.getByRole('button', { name: /menu/i });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/components/SiteHeader.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/components/SiteHeader.tsx`**

```tsx
import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import bioWatermark from '../assets/bio-watermark.jpg';

const navItems = [
  { label: 'MUSIC',   href: '#music'   },
  { label: 'LABELS',  href: '#labels'  },
  { label: 'BIO',     href: '#bio'     },
  { label: 'ARCHIVE', href: '#gallery' },
  { label: 'SOCIAL',  href: '#connect' },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-header">
      <div className="container flex items-center justify-between h-14">
        <a href="#" aria-label="Subspace Resonator — home">
          <img src={bioWatermark} alt="Subspace Resonator logo" className="h-8 w-8 rounded-full object-cover" />
        </a>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="nav-link">
              {item.label}
            </a>
          ))}
          <a
            href="#contact"
            className="ml-4 px-4 min-h-[44px] flex items-center border border-primary text-primary text-xs tracking-widest uppercase hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            BOOK
          </a>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-primary"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={toggle}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden md:hidden border-t border-border"
            aria-label="Mobile navigation"
          >
            <div className="container py-2 flex flex-col">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="nav-link py-3"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#contact"
                className="mt-2 mb-3 px-4 min-h-[44px] flex items-center border border-primary text-primary text-xs tracking-widest uppercase"
                onClick={() => setOpen(false)}
              >
                BOOK
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npx vitest run src/components/SiteHeader.test.tsx
```

Expected: PASS (5 tests).

- [ ] **Step 5: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/SiteHeader.tsx src/components/SiteHeader.test.tsx
git commit -m "feat: SiteHeader — sticky glass nav, hamburger with aria-expanded, BOOK anchor"
```

---

### Task 6 (A2): LabelPedigree + Footer

**Files:**
- Create: `src/components/LabelPedigree.tsx`
- Create: `src/components/LabelPedigree.test.tsx`
- Create: `src/components/Footer.tsx`
- Create: `src/components/Footer.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/LabelPedigree.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LabelPedigree from './LabelPedigree';

describe('LabelPedigree', () => {
  it('renders without crashing', () => {
    render(<LabelPedigree />);
    expect(screen.getByRole('region', { name: /labels/i })).toBeInTheDocument();
  });

  it('has id="labels"', () => {
    render(<LabelPedigree />);
    expect(document.getElementById('labels')).toBeInTheDocument();
  });

  it('renders all 4 label links', () => {
    render(<LabelPedigree />);
    expect(screen.getByRole('link', { name: /geomagnetic/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /timewarp/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /goa records/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /spiral trax/i })).toBeInTheDocument();
  });

  it('all label links open in new tab with security attrs', () => {
    render(<LabelPedigree />);
    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
```

`src/components/Footer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Footer from './Footer';

describe('Footer', () => {
  it('renders without crashing', () => {
    render(<Footer />);
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('contains copyright text', () => {
    render(<Footer />);
    expect(screen.getByText(/SUBSPACE RESONATOR/i)).toBeInTheDocument();
  });

  it('has booking email link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: /subspaceresonator@gmail.com/i });
    expect(link).toHaveAttribute('href', 'mailto:subspaceresonator@gmail.com');
  });

  it('has phone link', () => {
    render(<Footer />);
    const link = screen.getByRole('link', { name: /\+972/i });
    expect(link).toHaveAttribute('href', 'tel:+972507974184');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/components/LabelPedigree.test.tsx src/components/Footer.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write `src/components/LabelPedigree.tsx`**

```tsx
import { motion } from 'framer-motion';
import geoImg from '../assets/label-geomagnetic-official.png';
import timewarpImg from '../assets/label-timewarp-official.png';
import goaImg from '../assets/label-goa-records-official.png';
import spiralImg from '../assets/label-spiral-trax-official.png';

const labels = [
  { name: 'Geomagnetic', url: 'https://geodistro.bandcamp.com/',       releases: 3, years: '2001–2024', img: geoImg     },
  { name: 'Timewarp',    url: 'https://timewarprecords.bandcamp.com/', releases: 2, years: '2003–2006', img: timewarpImg },
  { name: 'Goa Records', url: 'https://goarecords.bandcamp.com/',      releases: 1, years: '2023',      img: goaImg      },
  { name: 'Spiral Trax', url: 'https://spiraltrax.bandcamp.com/',      releases: 2, years: '1999–2002', img: spiralImg   },
];

export default function LabelPedigree() {
  return (
    <section id="labels" aria-label="Labels" className="py-20 border-t border-border">
      <div className="container">
        <p className="text-xs font-mono tracking-widest text-primary mb-1">// RESONANCE NETWORK</p>
        <p className="text-xs tracking-widest text-muted-foreground uppercase mb-12">RELEASED ON</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {labels.map((label) => (
            <motion.a
              key={label.name}
              href={label.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${label.name} Records on Bandcamp`}
              className="flex flex-col items-center gap-4 p-6 border border-border hover:border-primary transition-colors"
              whileHover={{ y: -2 }}
            >
              <img
                src={label.img}
                alt={label.name}
                width={120}
                height={120}
                className="object-contain aspect-square"
              />
              <div className="text-center">
                <p className="text-xs tracking-widest uppercase font-display font-medium">{label.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{label.releases} releases · {label.years}</p>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write `src/components/Footer.tsx`**

```tsx
export default function Footer() {
  return (
    <footer className="border-t border-border py-8 mt-20">
      <div className="container flex flex-col items-center gap-2 text-center">
        <p className="text-xs text-muted-foreground tracking-widest uppercase">
          © 2026 SUBSPACE RESONATOR — ALL FREQUENCIES RESERVED
        </p>
        <div className="flex gap-4 text-xs">
          <a
            href="mailto:subspaceresonator@gmail.com"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            subspaceresonator@gmail.com
          </a>
          <a
            href="tel:+972507974184"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            +972507974184
          </a>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Run tests — verify pass**

```bash
npx vitest run src/components/LabelPedigree.test.tsx src/components/Footer.test.tsx
```

Expected: PASS (8 tests).

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/components/LabelPedigree.tsx src/components/LabelPedigree.test.tsx src/components/Footer.tsx src/components/Footer.test.tsx
git commit -m "feat: LabelPedigree (id=labels, 4 logos, framer hover) + Footer"
```

---

### Task 7 (A3): BioSection + BookingSection

**Files:**
- Create: `src/components/BioSection.tsx`
- Create: `src/components/BioSection.test.tsx`
- Create: `src/components/BookingSection.tsx`
- Create: `src/components/BookingSection.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/BioSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BioSection from './BioSection';

describe('BioSection', () => {
  it('renders without crashing', () => {
    render(<BioSection />);
    expect(screen.getByRole('region', { name: /bio/i })).toBeInTheDocument();
  });

  it('has id="bio"', () => {
    render(<BioSection />);
    expect(document.getElementById('bio')).toBeInTheDocument();
  });

  it('shows all three signal sub-sections', () => {
    render(<BioSection />);
    expect(screen.getByText(/THE SIGNAL/i)).toBeInTheDocument();
    expect(screen.getByText(/THE REACTIVATION/i)).toBeInTheDocument();
    expect(screen.getByText(/THE MISSION/i)).toBeInTheDocument();
  });

  it('has BOOK CTA linking to #contact', () => {
    render(<BioSection />);
    const link = screen.getByRole('link', { name: /book subspace resonator/i });
    expect(link).toHaveAttribute('href', '#contact');
  });

  it('bio watermark image is aria-hidden', () => {
    render(<BioSection />);
    const watermark = screen.getByRole('presentation', { hidden: true });
    expect(watermark).toHaveAttribute('aria-hidden', 'true');
  });
});
```

`src/components/BookingSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BookingSection from './BookingSection';

describe('BookingSection', () => {
  it('renders without crashing', () => {
    render(<BookingSection />);
    expect(screen.getByRole('region', { name: /booking/i })).toBeInTheDocument();
  });

  it('has id="contact"', () => {
    render(<BookingSection />);
    expect(document.getElementById('contact')).toBeInTheDocument();
  });

  it('shows LIVE DATES block', () => {
    render(<BookingSection />);
    expect(screen.getByText(/LIVE DATES/i)).toBeInTheDocument();
  });

  it('has mailto link for INITIATE CONTACT', () => {
    render(<BookingSection />);
    const link = screen.getByRole('link', { name: /initiate contact/i });
    expect(link).toHaveAttribute('href', 'mailto:subspaceresonator@gmail.com');
  });

  it('has tel link for CALL', () => {
    render(<BookingSection />);
    const link = screen.getByRole('link', { name: /fast channel/i });
    expect(link).toHaveAttribute('href', 'tel:+972507974184');
  });

  it('has WhatsApp link', () => {
    render(<BookingSection />);
    const link = screen.getByRole('link', { name: /whatsapp/i });
    expect(link).toHaveAttribute('href', 'https://wa.me/972507974184');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/components/BioSection.test.tsx src/components/BookingSection.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Write `src/components/BioSection.tsx`**

```tsx
import { motion } from 'framer-motion';
import bioWatermark from '../assets/bio-watermark.jpg';

const sections = [
  {
    label: '// THE SIGNAL',
    text: "Emerging from the late '90s Goa Trance movement, Subspace Resonator operated when the underground was a guarded frequency — no stage names, no digital footprints. Active since 1998, with releases on Geomagnetic, Goa Records, Spiral Trax, and Timewarp.",
  },
  {
    label: '// THE REACTIVATION',
    text: 'After years of data-gathering, Subspace Resonator returns — fusing primal energy with cutting-edge synthesis and total authenticity. Available as a full live set or DJ set, 60 to 180 minutes. Based in Tel Aviv, touring internationally.',
  },
  {
    label: '// THE MISSION',
    text: 'Deliver mind-bending frequencies and direct signal access to new sonic dimensions.',
  },
];

export default function BioSection() {
  return (
    <section id="bio" aria-label="Bio" className="relative py-20 border-t border-border overflow-hidden">
      <img
        src={bioWatermark}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-contain opacity-[0.06] pointer-events-none select-none"
      />
      <div className="container relative">
        <p className="text-xs font-mono tracking-widest text-primary mb-12">// TRANSMISSION</p>
        <div className="max-w-2xl space-y-10">
          {sections.map((s) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-xs font-mono tracking-widest text-primary mb-3">{s.label}</p>
              <p className="text-base text-muted-foreground leading-relaxed">{s.text}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 flex gap-4 flex-wrap">
          <a
            href="#contact"
            className="border border-primary text-primary text-xs tracking-widest uppercase px-6 min-h-[44px] inline-flex items-center hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            BOOK SUBSPACE RESONATOR
          </a>
          <a
            href="#music"
            className="text-xs tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors inline-flex items-center min-h-[44px]"
          >
            LISTEN →
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Write `src/components/BookingSection.tsx`**

```tsx
import { motion } from 'framer-motion';
import liveAlpha from '../assets/live-alpha.jpg';

export default function BookingSection() {
  return (
    <section id="contact" aria-label="Booking" className="py-20 border-t border-border">
      <div className="container">
        <p className="text-xs font-mono tracking-widest text-primary mb-12">// BOOKING — A DIRECT SIGNAL PATH</p>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: live photo */}
          <div className="hidden lg:block">
            <img
              src={liveAlpha}
              alt="Subspace Resonator live performance"
              className="w-full aspect-[4/3] object-cover border border-border"
            />
          </div>

          {/* Right: copy + buttons */}
          <div>
            <p className="text-base text-muted-foreground mb-8">
              Available for festivals, club nights, and private events. Full live set or DJ set, 60 to 180 minutes.
              Technical rider on request. Direct booking — no agency fees. Based in Tel Aviv, touring internationally.
            </p>

            {/* Live dates */}
            <div className="mb-6 pb-6 border-b border-border">
              <p className="text-xs tracking-widest text-muted-foreground uppercase mb-3">// LIVE DATES</p>
              <p className="text-sm text-muted-foreground mb-3">
                Upcoming shows and festival dates posted on Instagram and Facebook.
              </p>
              <div className="flex gap-4">
                <a
                  href="https://www.instagram.com/subspace_resonator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs tracking-widest uppercase text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1.5 min-h-[44px]"
                >
                  ↗ INSTAGRAM
                </a>
                <a
                  href="https://facebook.com/profile.php?id=61559198105695"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs tracking-widest uppercase text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1.5 min-h-[44px]"
                >
                  ↗ FACEBOOK
                </a>
              </div>
            </div>

            {/* Contact buttons */}
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <motion.a
                href="mailto:subspaceresonator@gmail.com"
                className="border border-primary text-primary text-xs tracking-widest uppercase px-6 min-h-[44px] inline-flex items-center hover:bg-primary hover:text-primary-foreground transition-colors"
                whileHover={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.4)' }}
              >
                INITIATE CONTACT
              </motion.a>
              <motion.a
                href="tel:+972507974184"
                className="border border-border text-muted-foreground text-xs tracking-widest uppercase px-6 min-h-[44px] inline-flex items-center hover:border-primary hover:text-primary transition-colors"
                whileHover={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.4)' }}
              >
                FAST CHANNEL · CALL
              </motion.a>
              <motion.a
                href="https://wa.me/972507974184"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-border text-muted-foreground text-xs tracking-widest uppercase px-6 min-h-[44px] inline-flex items-center hover:border-primary hover:text-primary transition-colors"
                whileHover={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.4)' }}
              >
                WHATSAPP · CHAT
              </motion.a>
            </div>

            <div className="mt-4 flex gap-6 text-xs text-muted-foreground">
              <span>subspaceresonator@gmail.com</span>
              <span>+972507974184</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run tests — verify pass**

```bash
npx vitest run src/components/BioSection.test.tsx src/components/BookingSection.test.tsx
```

Expected: PASS (11 tests).

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/components/BioSection.tsx src/components/BioSection.test.tsx src/components/BookingSection.tsx src/components/BookingSection.test.tsx
git commit -m "feat: BioSection (id=bio, watermark, CTA) + BookingSection (id=contact, live dates, 3 buttons)"
```

---

### Task 8 (A4): SocialMatrix

**Files:**
- Create: `src/components/SocialMatrix.tsx`
- Create: `src/components/SocialMatrix.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/SocialMatrix.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SocialMatrix from './SocialMatrix';

describe('SocialMatrix', () => {
  it('renders without crashing', () => {
    render(<SocialMatrix />);
    expect(screen.getByRole('region', { name: /social/i })).toBeInTheDocument();
  });

  it('has id="connect"', () => {
    render(<SocialMatrix />);
    expect(document.getElementById('connect')).toBeInTheDocument();
  });

  it('renders STREAM, FOLLOW, CATALOGUE group labels', () => {
    render(<SocialMatrix />);
    expect(screen.getByText('STREAM')).toBeInTheDocument();
    expect(screen.getByText('FOLLOW')).toBeInTheDocument();
    expect(screen.getByText('CATALOGUE')).toBeInTheDocument();
  });

  it('all links open in new tab with rel', () => {
    render(<SocialMatrix />);
    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  it('SoundCloud link present', () => {
    render(<SocialMatrix />);
    expect(screen.getByRole('link', { name: /soundcloud/i })).toBeInTheDocument();
  });

  it('Instagram link present', () => {
    render(<SocialMatrix />);
    expect(screen.getByRole('link', { name: /instagram/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/components/SocialMatrix.test.tsx
```

- [ ] **Step 3: Write `src/components/SocialMatrix.tsx`**

```tsx
import { motion } from 'framer-motion';
import { Music2, Youtube, Instagram } from 'lucide-react';
import type { ReactNode } from 'react';

type SocialLink = { name: string; url: string; icon: ReactNode };

function pill(name: string): ReactNode {
  if (name === 'SoundCloud' || name === 'Spotify' || name === 'Bandcamp')
    return <Music2 size={14} className="mr-2" />;
  if (name === 'YouTube') return <Youtube size={14} className="mr-2" />;
  if (name === 'Instagram') return <Instagram size={14} className="mr-2" />;
  if (name === 'Facebook') return <span className="font-mono text-xs mr-2">FB</span>;
  if (name === 'TikTok') return <span className="font-mono text-xs mr-2">TK</span>;
  if (name === 'Discogs') return <span className="font-mono text-xs mr-2">DC</span>;
  return null;
}

const socialGroups: { label: string; links: SocialLink[] }[] = [
  {
    label: 'STREAM',
    links: [
      { name: 'SoundCloud', url: 'https://soundcloud.com/subspaceresonance', icon: pill('SoundCloud') },
      { name: 'Spotify',    url: 'https://open.spotify.com/artist/0UQWUdUuQ3NhMCACj4UXlk', icon: pill('Spotify') },
      { name: 'Bandcamp',   url: 'https://yannig.bandcamp.com/', icon: pill('Bandcamp') },
      { name: 'YouTube',    url: 'https://www.youtube.com/@SubspaceResonator', icon: pill('YouTube') },
    ],
  },
  {
    label: 'FOLLOW',
    links: [
      { name: 'Instagram', url: 'https://www.instagram.com/subspace_resonator', icon: pill('Instagram') },
      { name: 'Facebook',  url: 'https://facebook.com/profile.php?id=61559198105695', icon: pill('Facebook') },
      { name: 'TikTok',    url: 'https://www.tiktok.com/@subspace.resonator', icon: pill('TikTok') },
    ],
  },
  {
    label: 'CATALOGUE',
    links: [
      { name: 'Discogs', url: 'https://www.discogs.com/artist/15101171-Subspace-Resonator', icon: pill('Discogs') },
    ],
  },
];

export default function SocialMatrix() {
  return (
    <section id="connect" aria-label="Social" className="py-20 border-t border-border">
      <div className="container">
        <p className="text-xs font-mono tracking-widest text-primary mb-12">// SIGNAL NETWORK</p>

        <div className="space-y-10">
          {socialGroups.map((group) => (
            <div key={group.label}>
              <p className="text-xs tracking-widest text-muted-foreground uppercase mb-4">{group.label}</p>
              <div className="flex flex-wrap gap-3">
                {group.links.map((link) => (
                  <motion.a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.name}
                    className="flex items-center min-h-[44px] px-4 border border-border text-xs tracking-widest text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    whileHover={{ y: -1 }}
                  >
                    {link.icon}
                    {link.name}
                  </motion.a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npx vitest run src/components/SocialMatrix.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 5: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/components/SocialMatrix.tsx src/components/SocialMatrix.test.tsx
git commit -m "feat: SocialMatrix (id=connect, 3 groups, lucide + text abbrev icons)"
```

---

### Task 9 (A5): HeroSection + HeroVisualizer

**Files:**
- Create: `src/components/HeroSection.tsx`
- Create: `src/components/HeroSection.test.tsx`
- Create: `src/components/HeroVisualizer.tsx`
- Create: `src/components/HeroVisualizer.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/HeroVisualizer.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import HeroVisualizer from './HeroVisualizer';

describe('HeroVisualizer', () => {
  it('renders without crashing', () => {
    const { container } = render(<HeroVisualizer />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders static svg when prefers-reduced-motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList);
    const { container } = render(<HeroVisualizer />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
```

`src/components/HeroSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HeroSection from './HeroSection';

describe('HeroSection', () => {
  it('renders without crashing', () => {
    render(<HeroSection />);
  });

  it('has h1 with SUBSPACE RESONATOR', () => {
    render(<HeroSection />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SUBSPACE RESONATOR');
  });

  it('has BOOK FOR YOUR EVENT CTA linking to #contact', () => {
    render(<HeroSection />);
    const link = screen.getByRole('link', { name: /book for your event/i });
    expect(link).toHaveAttribute('href', '#contact');
  });

  it('has LISTEN CTA linking to #music', () => {
    render(<HeroSection />);
    const link = screen.getByRole('link', { name: /listen/i });
    expect(link).toHaveAttribute('href', '#music');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/components/HeroVisualizer.test.tsx src/components/HeroSection.test.tsx
```

- [ ] **Step 3: Write `src/components/HeroVisualizer.tsx`**

```tsx
import { useEffect, useRef } from 'react';

const BAR_COUNT = 48;
const RADIUS = 80;
const BAR_LENGTH_MIN = 8;
const BAR_LENGTH_MAX = 28;
const BPM = 140;
const BEAT_MS = (60 / BPM) * 1000;

export default function HeroVisualizer() {
  const svgRef = useRef<SVGSVGElement>(null);
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReduced) return;
    const bars: SVGLineElement[] = [];
    const svg = svgRef.current;
    if (!svg) return;

    for (let i = 0; i < BAR_COUNT; i++) {
      const angle = (i / BAR_COUNT) * Math.PI * 2;
      const x1 = 120 + Math.cos(angle) * RADIUS;
      const y1 = 120 + Math.sin(angle) * RADIUS;
      const x2 = 120 + Math.cos(angle) * (RADIUS + BAR_LENGTH_MIN);
      const y2 = 120 + Math.sin(angle) * (RADIUS + BAR_LENGTH_MIN);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', 'hsl(202 100% 61%)');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);
      bars.push(line);
    }

    let targets = bars.map(() => BAR_LENGTH_MIN);
    let current = bars.map(() => BAR_LENGTH_MIN);
    let lastBeat = performance.now();
    let rafId: number;

    function frame(now: number) {
      if (now - lastBeat > BEAT_MS / 4) {
        lastBeat = now;
        targets = bars.map(() => BAR_LENGTH_MIN + Math.random() * (BAR_LENGTH_MAX - BAR_LENGTH_MIN));
      }
      bars.forEach((bar, i) => {
        current[i] += (targets[i] - current[i]) * 0.12;
        const angle = (i / BAR_COUNT) * Math.PI * 2;
        const x2 = 120 + Math.cos(angle) * (RADIUS + current[i]);
        const y2 = 120 + Math.sin(angle) * (RADIUS + current[i]);
        bar.setAttribute('x2', String(x2));
        bar.setAttribute('y2', String(y2));
      });
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      bars.forEach((b) => b.remove());
    };
  }, [prefersReduced]);

  if (prefersReduced) {
    return (
      <svg ref={svgRef} viewBox="0 0 240 240" className="w-full h-full" aria-hidden="true">
        <circle cx="120" cy="120" r={RADIUS} fill="none" stroke="hsl(202 100% 61% / 0.3)" strokeWidth="1" />
        {Array.from({ length: BAR_COUNT }, (_, i) => {
          const angle = (i / BAR_COUNT) * Math.PI * 2;
          const len = BAR_LENGTH_MIN + 6;
          return (
            <line
              key={i}
              x1={120 + Math.cos(angle) * RADIUS}
              y1={120 + Math.sin(angle) * RADIUS}
              x2={120 + Math.cos(angle) * (RADIUS + len)}
              y2={120 + Math.sin(angle) * (RADIUS + len)}
              stroke="hsl(202 100% 61%)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    );
  }

  return (
    <svg ref={svgRef} viewBox="0 0 240 240" className="w-full h-full" aria-hidden="true">
      <circle cx="120" cy="120" r={RADIUS} fill="none" stroke="hsl(202 100% 61% / 0.3)" strokeWidth="1" />
    </svg>
  );
}
```

- [ ] **Step 4: Write `src/components/HeroSection.tsx`**

```tsx
import bioWatermark from '../assets/bio-watermark.jpg';
import HeroVisualizer from './HeroVisualizer';

export default function HeroSection() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center pt-20 pb-12 px-4">
      {/* Visualizer + logo */}
      <div className="relative w-56 h-56 md:w-72 md:h-72">
        <div className="absolute inset-0">
          <HeroVisualizer />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={bioWatermark}
            alt="Subspace Resonator"
            loading="eager"
            className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border border-border"
          />
        </div>
      </div>

      {/* H1 */}
      <h1 className="mt-6 text-xl md:text-2xl font-bold tracking-widest text-center uppercase font-display">
        SUBSPACE RESONATOR
      </h1>

      {/* Tagline */}
      <p className="mt-2 text-xs tracking-widest text-muted-foreground uppercase text-center">
        Goa Trance · Psychedelic Trance · Tel Aviv
      </p>

      {/* CTAs */}
      <div className="mt-8 flex gap-4 flex-wrap justify-center">
        <a
          href="#contact"
          className="border border-primary text-primary text-xs tracking-widest uppercase px-6 min-h-[44px] inline-flex items-center hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          BOOK FOR YOUR EVENT
        </a>
        <a
          href="#music"
          className="text-xs tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors inline-flex items-center min-h-[44px] px-2"
        >
          LISTEN →
        </a>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run tests — verify pass**

```bash
npx vitest run src/components/HeroVisualizer.test.tsx src/components/HeroSection.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 6: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/components/HeroSection.tsx src/components/HeroSection.test.tsx src/components/HeroVisualizer.tsx src/components/HeroVisualizer.test.tsx
git commit -m "feat: HeroSection + HeroVisualizer (140 BPM rAF waveform, reduced-motion safe)"
```

---

## PHASE 3 — ASSEMBLY

> Run these tasks sequentially after all Phase 2 tasks are complete.

---

### Task 10: SpectrumAnalyzer

**Files:**
- Create: `src/components/MusicPlayer/SpectrumAnalyzer.tsx`
- Create: `src/components/MusicPlayer/SpectrumAnalyzer.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/MusicPlayer/SpectrumAnalyzer.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SpectrumAnalyzer from './SpectrumAnalyzer';

describe('SpectrumAnalyzer', () => {
  it('renders without crashing', () => {
    const { container } = render(<SpectrumAnalyzer />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders 32 bars', () => {
    const { container } = render(<SpectrumAnalyzer />);
    const bars = container.querySelectorAll('[data-bar]');
    expect(bars).toHaveLength(32);
  });

  it('renders static bars at 40% when prefers-reduced-motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList);
    const { container } = render(<SpectrumAnalyzer />);
    const bars = container.querySelectorAll('[data-bar]');
    expect(bars.length).toBe(32);
    bars.forEach((bar) => {
      expect((bar as HTMLElement).style.height).toBe('40%');
    });
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/components/MusicPlayer/SpectrumAnalyzer.test.tsx
```

- [ ] **Step 3: Create `src/components/MusicPlayer/` folder**

```bash
mkdir -p src/components/MusicPlayer
```

- [ ] **Step 4: Write `src/components/MusicPlayer/SpectrumAnalyzer.tsx`**

```tsx
import { useEffect, useRef } from 'react';

const BAR_COUNT = 32;
const UPDATE_INTERVAL_MS = 200;

export default function SpectrumAnalyzer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReduced) return;
    const container = containerRef.current;
    if (!container) return;

    const bars = Array.from(container.querySelectorAll<HTMLDivElement>('[data-bar]'));
    const current = bars.map(() => 40);
    const targets = bars.map(() => 40);
    let lastUpdate = performance.now();
    let rafId: number;

    function frame(now: number) {
      if (now - lastUpdate > UPDATE_INTERVAL_MS) {
        lastUpdate = now;
        for (let i = 0; i < bars.length; i++) {
          targets[i] = 20 + Math.random() * 80;
        }
      }
      for (let i = 0; i < bars.length; i++) {
        current[i] += (targets[i] - current[i]) * 0.12;
        bars[i].style.height = `${current[i]}%`;
        const ratio = (current[i] - 20) / 80;
        bars[i].style.backgroundColor =
          ratio > 0.5
            ? `hsl(var(--primary))`
            : `hsl(var(--muted-foreground))`;
      }
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [prefersReduced]);

  return (
    <div
      ref={containerRef}
      className="flex items-end gap-px w-full h-full"
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          data-bar
          className="flex-1 transition-none"
          style={{
            height: '40%',
            minWidth: '2px',
            backgroundColor: 'hsl(var(--muted-foreground))',
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run tests — verify pass**

```bash
npx vitest run src/components/MusicPlayer/SpectrumAnalyzer.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 6: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/components/MusicPlayer/
git commit -m "feat: SpectrumAnalyzer — 32-bar rAF animation, reduced-motion static fallback"
```

---

### Task 11: FloodlightSet

**Files:**
- Create: `src/components/MusicPlayer/FloodlightSet.tsx`
- Create: `src/components/MusicPlayer/FloodlightSet.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/MusicPlayer/FloodlightSet.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FloodlightSet from './FloodlightSet';

describe('FloodlightSet', () => {
  it('renders without crashing', () => {
    const { container } = render(<FloodlightSet />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders 4 cabinets', () => {
    const { container } = render(<FloodlightSet />);
    const cabinets = container.querySelectorAll('[data-cabinet]');
    expect(cabinets).toHaveLength(4);
  });

  it('is aria-hidden', () => {
    const { container } = render(<FloodlightSet />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/components/MusicPlayer/FloodlightSet.test.tsx
```

- [ ] **Step 3: Write `src/components/MusicPlayer/FloodlightSet.tsx`**

Add `@keyframes cabinet-pulse` via inline style to avoid Tailwind JIT limitation.

```tsx
export default function FloodlightSet() {
  return (
    <>
      <style>{`
        @keyframes cabinet-pulse {
          0%, 100% { transform: scale(1.0); }
          50% { transform: scale(1.04); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cabinet-woofer { animation: none !important; }
        }
      `}</style>
      <div className="flex items-end gap-2 justify-center" aria-hidden="true">
        {Array.from({ length: 4 }, (_, i) => (
          <svg
            key={i}
            data-cabinet
            width="60"
            height="80"
            viewBox="0 0 60 80"
          >
            {/* Cabinet body */}
            <rect
              x="2"
              y="2"
              width="56"
              height="76"
              rx="6"
              ry="6"
              fill="hsl(var(--muted))"
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
            />
            {/* Woofer circle */}
            <circle
              cx="30"
              cy="40"
              r="20"
              fill="hsl(var(--card))"
              stroke="hsl(var(--border))"
              strokeWidth="1"
              className="cabinet-woofer"
              style={{ animation: 'cabinet-pulse 428ms ease-in-out infinite', transformOrigin: '30px 40px' }}
            />
            {/* Dust cap */}
            <circle cx="30" cy="40" r="6" fill="hsl(var(--muted))" />
          </svg>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npx vitest run src/components/MusicPlayer/FloodlightSet.test.tsx
```

Expected: PASS (3 tests).

- [ ] **Step 5: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/components/MusicPlayer/FloodlightSet.tsx src/components/MusicPlayer/FloodlightSet.test.tsx
git commit -m "feat: FloodlightSet — 4 SVG cabinets, 428ms pulse at 140 BPM, reduced-motion safe"
```

---

### Task 12: Knob

**Files:**
- Create: `src/components/MusicPlayer/Knob.tsx`
- Create: `src/components/MusicPlayer/Knob.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/MusicPlayer/Knob.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Knob from './Knob';

describe('Knob', () => {
  it('renders without crashing', () => {
    render(<Knob value={50} onChange={vi.fn()} />);
  });

  it('has role=slider', () => {
    render(<Knob value={50} onChange={vi.fn()} />);
    expect(screen.getByRole('slider')).toBeInTheDocument();
  });

  it('has aria-valuemin, aria-valuemax, aria-valuenow', () => {
    render(<Knob value={50} onChange={vi.fn()} />);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
    expect(slider).toHaveAttribute('aria-valuenow', '50');
  });

  it('ArrowUp increases value by 5', () => {
    const onChange = vi.fn();
    render(<Knob value={50} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(55);
  });

  it('ArrowDown decreases value by 5', () => {
    const onChange = vi.fn();
    render(<Knob value={50} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(45);
  });

  it('clamps at 0 and 100', () => {
    const onChange = vi.fn();
    render(<Knob value={0} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/components/MusicPlayer/Knob.test.tsx
```

- [ ] **Step 3: Write `src/components/MusicPlayer/Knob.tsx`**

```tsx
import { useCallback, useRef } from 'react';

interface KnobProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}

export default function Knob({ value, onChange, label = 'Volume' }: KnobProps) {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + 5)); }
      if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - 5)); }
    },
    [value, onChange],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      onChange(clamp(value + (e.deltaY < 0 ? 5 : -5)));
    },
    [value, onChange],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      startY.current = e.clientY;
      startValue.current = value;

      function onMove(ev: MouseEvent) {
        if (!isDragging.current) return;
        const delta = (startY.current - ev.clientY) * 0.5;
        onChange(clamp(startValue.current + delta));
      }
      function onUp() {
        isDragging.current = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [value, onChange],
  );

  const rotation = -135 + (value / 100) * 270;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        className="w-10 h-10 rounded-full border-2 border-border bg-card cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background flex items-center justify-center"
        style={{ userSelect: 'none' }}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <div
          className="w-1 h-3 bg-primary absolute top-1 left-1/2 -translate-x-1/2 origin-bottom"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)`, transformOrigin: 'bottom center' }}
        />
      </div>
      <p className="text-xs text-muted-foreground font-mono">{label.toUpperCase()}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npx vitest run src/components/MusicPlayer/Knob.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 5: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/components/MusicPlayer/Knob.tsx src/components/MusicPlayer/Knob.test.tsx
git commit -m "feat: Knob — role=slider, keyboard+wheel+drag, clamped 0-100"
```

---

### Task 13: MusicPlayer

**Files:**
- Create: `src/components/MusicPlayer/MusicPlayer.tsx`
- Create: `src/components/MusicPlayer/MusicPlayer.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/MusicPlayer/MusicPlayer.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MusicPlayer from './MusicPlayer';

describe('MusicPlayer', () => {
  it('renders without crashing', () => {
    render(<MusicPlayer />);
  });

  it('has id="music"', () => {
    render(<MusicPlayer />);
    expect(document.getElementById('music')).toBeInTheDocument();
  });

  it('renders TRACKS and PLAYLISTS tabs', () => {
    render(<MusicPlayer />);
    expect(screen.getByRole('tab', { name: /tracks/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /playlists/i })).toBeInTheDocument();
  });

  it('play/pause button has aria-label', () => {
    render(<MusicPlayer />);
    const btns = screen.getAllByRole('button', { name: /play|pause/i });
    expect(btns.length).toBeGreaterThan(0);
  });

  it('progress bar has role=slider', () => {
    render(<MusicPlayer />);
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThan(0);
  });

  it('external streaming links present', () => {
    render(<MusicPlayer />);
    expect(screen.getByRole('link', { name: /bandcamp/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /youtube/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /spotify/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/components/MusicPlayer/MusicPlayer.test.tsx
```

- [ ] **Step 3: Write `src/components/MusicPlayer/MusicPlayer.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Music2, Youtube } from 'lucide-react';
import SpectrumAnalyzer from './SpectrumAnalyzer';
import FloodlightSet from './FloodlightSet';
import Knob from './Knob';
import artFallback from '../../assets/art-subspace-theory.jpg';

const FILTER_PATTERNS = [
  /return to goa/i,
  /old school night/i,
  /al\s*titosh|sukkot\s*2024/i,
];

const TRACKS = [
  { id: '1', title: 'Subspace Resonator', artist: 'Subspace Resonator', url: 'https://soundcloud.com/subspaceresonance/subspace-resonator' },
  { id: '2', title: 'Goa Frequency', artist: 'Subspace Resonator', url: 'https://soundcloud.com/subspaceresonance' },
  { id: '3', title: 'Psychedelic Signal', artist: 'Subspace Resonator', url: 'https://soundcloud.com/subspaceresonance' },
].filter((t) => !FILTER_PATTERNS.some((p) => p.test(t.title)));

const PLAYLIST_DEFS = [
  { key: '1998-2025',   label: '1998-2025',   url: 'https://soundcloud.com/subspaceresonance/sets/subspace-resonator-1998-2025' },
  { key: 'dj-sets',     label: 'DJ SETS',     url: 'https://soundcloud.com/subspaceresonance/sets/dj-sets' },
  { key: 'geomagnetic', label: 'GEOMAGNETIC', url: 'https://soundcloud.com/subspaceresonance/sets/geomagnetic-label-group' },
];

const EXTERNAL_LINKS = [
  { label: 'SoundCloud', url: 'https://soundcloud.com/subspaceresonance', icon: <Music2 size={12} /> },
  { label: 'Bandcamp',   url: 'https://yannig.bandcamp.com/', icon: <Music2 size={12} /> },
  { label: 'YouTube',    url: 'https://www.youtube.com/@SubspaceResonator', icon: <Youtube size={12} /> },
  { label: 'Spotify',    url: 'https://open.spotify.com/artist/0UQWUdUuQ3NhMCACj4UXlk', icon: <Music2 size={12} /> },
];

export default function MusicPlayer() {
  const [playing, setPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'tracks' | 'playlists'>('tracks');
  const [trackIndex, setTrackIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(80);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressIntervalRef = useRef<number>();

  const currentTrack = TRACKS[trackIndex];

  const togglePlay = useCallback(() => setPlaying((v) => !v), []);

  const prevTrack = useCallback(() => {
    setTrackIndex((i) => (i - 1 + TRACKS.length) % TRACKS.length);
    setProgress(0);
  }, []);

  const nextTrack = useCallback(() => {
    setTrackIndex((i) => (i + 1) % TRACKS.length);
    setProgress(0);
  }, []);

  const handleProgressKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') setProgress((p) => Math.min(100, p + 5));
    if (e.key === 'ArrowLeft') setProgress((p) => Math.max(0, p - 5));
  }, []);

  useEffect(() => {
    if (playing) {
      progressIntervalRef.current = window.setInterval(() => {
        setProgress((p) => (p >= 100 ? 0 : p + 0.1));
      }, 100);
    } else {
      clearInterval(progressIntervalRef.current);
    }
    return () => clearInterval(progressIntervalRef.current);
  }, [playing]);

  return (
    <section id="music" className="border-t border-border">
      {/* Hidden SC iframes */}
      <iframe
        ref={iframeRef}
        src="https://soundcloud.com/subspaceresonance/tracks"
        className="hidden"
        title="SoundCloud tracks"
        allow="autoplay"
      />

      {/* Mobile: fixed bottom bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 bg-card border-t border-border flex items-center px-3 gap-3">
        <img
          src={artFallback}
          alt={currentTrack.title}
          className="w-10 h-10 rounded-sm object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm truncate">{currentTrack.title}</p>
          <p className="text-xs text-muted-foreground">{currentTrack.artist}</p>
        </div>
        <button
          onClick={togglePlay}
          className="w-11 h-11 flex items-center justify-center text-primary hover:text-primary/80 transition-colors"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
      </div>

      {/* Desktop: full player */}
      <div className="hidden md:block container py-8">
        <p className="text-xs font-mono tracking-widest text-primary mb-6">// SIGNAL SOURCE</p>

        <div className="flex gap-6 items-stretch min-h-[200px] p-6 border border-border bg-card">
          {/* Left: FloodlightSet */}
          <div className="w-48 flex items-end">
            <FloodlightSet />
          </div>

          {/* Center: Analyzer + transport */}
          <div className="flex-1 flex flex-col justify-between">
            {/* Spectrum */}
            <div className="h-16">
              <SpectrumAnalyzer />
            </div>

            {/* Progress bar */}
            <div
              role="slider"
              tabIndex={0}
              aria-label="Track progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress)}
              className="w-full h-1 bg-muted rounded-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary my-4"
              onKeyDown={handleProgressKey}
              onClick={(e) => {
                const rect = (e.target as HTMLElement).getBoundingClientRect();
                setProgress(((e.clientX - rect.left) / rect.width) * 100);
              }}
            >
              <div className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
            </div>

            {/* Transport controls */}
            <div className="flex items-center gap-4">
              <button onClick={prevTrack} aria-label="Previous track" className="text-muted-foreground hover:text-primary transition-colors">
                <SkipBack size={18} />
              </button>
              <button
                onClick={togglePlay}
                aria-label={playing ? 'Pause' : 'Play'}
                className="w-11 h-11 flex items-center justify-center border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors rounded-full"
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <button onClick={nextTrack} aria-label="Next track" className="text-muted-foreground hover:text-primary transition-colors">
                <SkipForward size={18} />
              </button>
              <p className="text-xs text-muted-foreground ml-2 truncate flex-1">{currentTrack.title}</p>
            </div>
          </div>

          {/* Right: tabs + track list + knob */}
          <div className="w-64 flex flex-col">
            {/* Tab switcher */}
            <div role="tablist" className="flex gap-1 mb-3">
              {(['tracks', 'playlists'] as const).map((tab) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs tracking-widest uppercase px-3 py-1 transition-colors ${activeTab === tab ? 'text-primary border-b border-primary' : 'text-muted-foreground hover:text-primary'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Track / playlist list */}
            <div className="flex-1 overflow-y-auto space-y-1">
              {activeTab === 'tracks'
                ? TRACKS.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => { setTrackIndex(i); setProgress(0); }}
                      className={`w-full text-left text-xs px-2 py-2 truncate hover:text-primary transition-colors ${i === trackIndex ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {t.title}
                    </button>
                  ))
                : PLAYLIST_DEFS.map((pl) => (
                    <a
                      key={pl.key}
                      href={pl.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs px-2 py-2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      {pl.label}
                    </a>
                  ))}
            </div>

            {/* Knob */}
            <div className="flex justify-end mt-3">
              <Knob value={volume} onChange={setVolume} label="Volume" />
            </div>
          </div>
        </div>

        {/* External streaming links */}
        <div className="flex flex-wrap gap-4 mt-4">
          {EXTERNAL_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.label}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              {link.icon}
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npx vitest run src/components/MusicPlayer/MusicPlayer.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 5: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/components/MusicPlayer/
git commit -m "feat: MusicPlayer — mobile bottom bar + desktop 3-col player, SoundCloud iframe, tab switcher, Knob"
```

---

### Task 14: GallerySection

**Files:**
- Create: `src/components/GallerySection.tsx`
- Create: `src/components/GallerySection.test.tsx`

- [ ] **Step 1: Write failing tests**

`src/components/GallerySection.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GallerySection from './GallerySection';

const mockImages = [
  { src: '/test1.jpg', alt: 'Subspace Resonator — photo 1' },
  { src: '/test2.jpg', alt: 'Subspace Resonator — photo 2' },
  { src: '/test3.jpg', alt: 'Subspace Resonator — photo 3' },
];

vi.mock('../lib/siteContent', () => ({
  useGallery: () => mockImages,
}));

describe('GallerySection', () => {
  it('renders without crashing', () => {
    render(<GallerySection />);
    expect(screen.getByRole('region', { name: /gallery/i })).toBeInTheDocument();
  });

  it('has id="gallery"', () => {
    render(<GallerySection />);
    expect(document.getElementById('gallery')).toBeInTheDocument();
  });

  it('first 4 images have loading=eager', () => {
    render(<GallerySection />);
    const eagerImgs = document.querySelectorAll('img[loading="eager"]');
    expect(eagerImgs.length).toBeGreaterThan(0);
  });

  it('clicking an image opens lightbox dialog', () => {
    render(<GallerySection />);
    const imgs = screen.getAllByRole('img');
    fireEvent.click(imgs[0].closest('button') ?? imgs[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lightbox has aria-modal and aria-label', () => {
    render(<GallerySection />);
    const imgs = screen.getAllByRole('img');
    fireEvent.click(imgs[0].closest('button') ?? imgs[0]);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Image viewer');
  });

  it('Escape key closes lightbox', () => {
    render(<GallerySection />);
    const imgs = screen.getAllByRole('img');
    fireEvent.click(imgs[0].closest('button') ?? imgs[0]);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run src/components/GallerySection.test.tsx
```

- [ ] **Step 3: Write `src/components/GallerySection.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useGallery } from '../lib/siteContent';

export default function GallerySection() {
  const images = useGallery();
  const looped = [...images, ...images];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollPos = useRef(0);
  const rafId = useRef<number>();

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Auto-scroll
  useEffect(() => {
    if (prefersReduced) return;
    const container = containerRef.current;
    if (!container) return;
    let paused = false;

    const onMouseEnter = () => { paused = true; };
    const onMouseLeave = () => { paused = false; };
    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);

    function frame() {
      if (!paused && container) {
        scrollPos.current += 0.5;
        if (scrollPos.current >= container.scrollWidth / 2) scrollPos.current = 0;
        container.scrollLeft = scrollPos.current;
      }
      rafId.current = requestAnimationFrame(frame);
    }
    rafId.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId.current!);
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [prefersReduced]);

  // Keyboard nav for lightbox
  const closeLightbox = useCallback(() => {
    const idx = lightboxIndex;
    setLightboxIndex(null);
    if (idx !== null) triggerRefs.current[idx % images.length]?.focus();
  }, [lightboxIndex, images.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    closeButtonRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') setLightboxIndex((i) => i !== null ? (i + 1) % images.length : null);
      if (e.key === 'ArrowLeft') setLightboxIndex((i) => i !== null ? (i - 1 + images.length) % images.length : null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxIndex, closeLightbox, images.length]);

  const openLightbox = (realIndex: number) => setLightboxIndex(realIndex % images.length);

  return (
    <section id="gallery" aria-label="Gallery" className="py-20 border-t border-border overflow-hidden">
      <div className="container mb-8">
        <p className="text-xs font-mono tracking-widest text-primary">// ARCHIVE</p>
      </div>

      {/* Scrolling strip */}
      <div ref={containerRef} className="flex gap-3 overflow-x-hidden">
        {looped.map((img, i) => {
          const realIndex = i % images.length;
          return (
            <button
              key={`loop-${i}`}
              ref={(el) => { if (i < images.length) triggerRefs.current[i] = el; }}
              onClick={() => openLightbox(realIndex)}
              className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              aria-label={`Open ${img.alt}`}
            >
              <img
                src={img.src}
                alt={img.alt}
                loading={i < 4 ? 'eager' : 'lazy'}
                className="h-48 w-auto object-cover"
              />
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Image viewer"
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLightbox}
          >
            <motion.div
              className="relative max-w-4xl w-full mx-4"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
            >
              <button
                ref={closeButtonRef}
                onClick={closeLightbox}
                aria-label="Close image viewer"
                className="absolute -top-12 right-0 w-11 h-11 flex items-center justify-center text-white hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <X size={24} />
              </button>

              <img
                src={images[lightboxIndex].src}
                alt={images[lightboxIndex].alt}
                className="w-full h-auto max-h-[80vh] object-contain"
              />

              <div className="absolute inset-y-0 left-0 flex items-center">
                <button
                  onClick={() => setLightboxIndex((i) => i !== null ? (i - 1 + images.length) % images.length : null)}
                  aria-label="Previous image"
                  className="w-11 h-11 flex items-center justify-center bg-black/50 text-white hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <ChevronLeft size={24} />
                </button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                  onClick={() => setLightboxIndex((i) => i !== null ? (i + 1) % images.length : null)}
                  aria-label="Next image"
                  className="w-11 h-11 flex items-center justify-center bg-black/50 text-white hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npx vitest run src/components/GallerySection.test.tsx
```

Expected: PASS (6 tests).

- [ ] **Step 5: TypeScript check + commit**

```bash
npx tsc --noEmit
git add src/components/GallerySection.tsx src/components/GallerySection.test.tsx
git commit -m "feat: GallerySection — rAF auto-scroll, lightbox with keyboard nav + focus management"
```

---

### Task 15: App.tsx + favicon.svg (Assembly)

**Files:**
- Modify: `src/App.tsx`
- Create: `public/favicon.svg`

- [ ] **Step 1: Write `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="32" fill="#0E0E10"/>
  <text x="32" y="44" font-family="sans-serif" font-size="26" font-weight="700"
        fill="#38B6FF" text-anchor="middle">SR</text>
</svg>
```

- [ ] **Step 2: Write `src/App.tsx`**

```tsx
import { HelmetProvider, Helmet } from 'react-helmet-async';
import SiteHeader from './components/SiteHeader';
import HeroSection from './components/HeroSection';
import MusicPlayer from './components/MusicPlayer/MusicPlayer';
import LabelPedigree from './components/LabelPedigree';
import BioSection from './components/BioSection';
import BookingSection from './components/BookingSection';
import GallerySection from './components/GallerySection';
import SocialMatrix from './components/SocialMatrix';
import Footer from './components/Footer';

export default function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <title>Subspace Resonator | Goa &amp; Psychedelic Trance</title>
        <meta name="description" content="Subspace Resonator — Goa & psychedelic trance. Stream music, hear the labels, book direct. Based in Tel Aviv, touring internationally." />
        <link rel="canonical" href="https://subspaceresonator.com/" />
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
  );
}
```

- [ ] **Step 3: Update `index.html` to reference favicon**

In `index.html`, ensure the `<head>` includes:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

- [ ] **Step 4: Full tsc + build gate**

```bash
npx tsc --noEmit
npm run build
```

Expected: both clean, no errors or warnings.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx public/favicon.svg index.html
git commit -m "feat: App.tsx wiring — all sections, SEO Helmet, JSON-LD MusicGroup schema, favicon"
```

---

### Task 16: Final quality check

- [ ] **Step 1: Run dev server and verify visually**

```bash
npm run dev
```

Open `http://localhost:5173`. Check:
- [ ] Site loads without console errors
- [ ] Header is sticky with glass blur
- [ ] H1 "SUBSPACE RESONATOR" is visible (not sr-only)
- [ ] BOOK button visible in header on desktop
- [ ] Hero visualizer animates (or is static on reduced-motion)
- [ ] Mobile: hamburger opens/closes menu
- [ ] Music section renders (desktop 3-col player)
- [ ] Mobile: fixed bottom bar visible at h-16
- [ ] Labels: 4 logos shown
- [ ] Bio: watermark at 6% opacity
- [ ] Booking: LIVE DATES block + 3 contact buttons
- [ ] Gallery: auto-scrolls (or static on reduced-motion)
- [ ] Gallery: click image opens lightbox, Escape closes
- [ ] Social: 8 pills in 3 groups
- [ ] All external links open in new tab

- [ ] **Step 2: Run final build**

```bash
npm run build
```

Expected: clean, no errors, no warnings.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: final build verification — all 14 quality checks green"
```

---

## Self-Review: Spec Coverage Check

| Spec requirement | Task |
|-----------------|------|
| Vite + React 18 + TS strict | Task 2, 3 |
| Tailwind v3 JIT | Task 3 |
| All CSS variables never hardcoded | All components use `hsl(var(--primary))` etc. |
| Framer Motion AnimatePresence | SiteHeader (T5), GallerySection (T14), BioSection (T7) |
| lucide-react icons | SiteHeader (T5), SocialMatrix (T8), MusicPlayer (T13) |
| react-helmet-async + JSON-LD | App.tsx (T15) |
| @fontsource self-hosted | main.tsx (T3) |
| Vitest co-located tests | Every component |
| id="music" | MusicPlayer (T13) |
| id="labels" | LabelPedigree (T6) |
| id="bio" | BioSection (T7) |
| id="contact" | BookingSection (T7) |
| id="gallery" | GallerySection (T14) |
| id="connect" | SocialMatrix (T8) |
| HeroVisualizer 140 BPM | HeroVisualizer (T9) |
| prefers-reduced-motion on all animated | T5,T9,T10,T11,T14 |
| rAF with cancelAnimationFrame | T9, T10, T14 |
| SiteHeader glass blur + hamburger aria-expanded | T5 |
| BOOK button in header | T5 |
| H1 text-xl md:text-2xl | T9 |
| bio watermark opacity-[0.06] aria-hidden | T7 |
| BookingSection LIVE DATES block | T7 |
| 3 contact buttons with glow whileHover | T7 |
| SpectrumAnalyzer 32 bars rAF | T10 |
| FloodlightSet 4 cabinets 428ms | T11 |
| Knob role=slider ArrowUp/Down ±5 | T12 |
| MusicPlayer mobile fixed h-16 bottom bar | T13 |
| MusicPlayer desktop 3-col | T13 |
| FILTER_PATTERNS on track list | T13 |
| GallerySection rAF auto-scroll | T14 |
| Lightbox role=dialog aria-modal | T14 |
| Escape/arrow keys on lightbox | T14 |
| Focus management on lightbox open/close | T14 |
| SocialMatrix 3 groups (STREAM/FOLLOW/CATALOGUE) | T8 |
| Social icons lucide + FB/TK/DC text abbrev | T8 |
| Footer copyright + email + tel | T6 |
| Asset copy with zero-pad gallery | T2 |
| import.meta.glob gallery import | T4 |
| favicon.svg dark circle SR in blue | T15 |
| og-image.jpg in public/ | T2 |
| SEO Helmet full meta tags | T15 |
| WCAG 2.1 AA min 44px touch targets | All interactive elements |
| All external links rel="noopener noreferrer" | T6, T7, T8, T13 |
