# UX Audit Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 13 UI/UX committee audit findings across accessibility, performance, animation, and interaction quality for the Subspace Resonator landing page.

**Architecture:** Three parallel implementation agents (Alpha / Beta / Gamma) with zero file conflicts — each owns a non-overlapping set of files. A QA agent runs after all three complete to capture screenshots and re-verify every finding.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Tailwind CSS v3, Framer Motion, Lucide React icons. No unit test runner configured — verification is visual via dev server at `http://localhost:5173`.

---

## ⚡ PARALLEL EXECUTION — Tasks A, B, and C have zero shared files. Run all three simultaneously.

---

## Task A — MusicPlayer Fixes `[Agent ALPHA]`

**Spec findings covered:** C1 (touch targets), C2 (text floor), H3 (lazy playlist iframe), L2 (heading rename)

**Files:**
- Modify: `src/components/MusicPlayer/MusicPlayer.tsx`

---

- [ ] **A1 — Start dev server**

```powershell
npm run dev
```

Open `http://localhost:5173` in browser. Confirm site loads. Keep server running throughout.

---

- [ ] **A2 — Fix C2: Raise text floor to 10px (desktop player bar)**

In `src/components/MusicPlayer/MusicPlayer.tsx`, find and replace these three text-size violations in the desktop bar (around lines 467, 474-475, 498, 508):

**Change 1** — Desktop "SUBSPACE RESONATOR" label (line ~467):
```tsx
// BEFORE
<p className="text-[8px] lg:text-[9px] text-muted-foreground tracking-[0.2em] mt-1">SUBSPACE RESONATOR</p>

// AFTER
<p className="text-[10px] text-muted-foreground tracking-[0.2em] mt-1">SUBSPACE RESONATOR</p>
```

**Change 2** — Desktop timestamp spans (lines ~474-475):
```tsx
// BEFORE
<span className="text-[7px] text-muted-foreground tracking-widest">{formatTime(position)}</span>
<span className="text-[7px] text-muted-foreground tracking-widest">{duration > 0 ? formatTime(duration) : "--:--"}</span>

// AFTER
<span className="text-[10px] text-muted-foreground tracking-widest">{formatTime(position)}</span>
<span className="text-[10px] text-muted-foreground tracking-widest">{duration > 0 ? formatTime(duration) : "--:--"}</span>
```

**Change 3** — Channel strip CH-L / CH-R labels (line ~498, inside the `.map()`):
```tsx
// BEFORE
<span style={{ fontSize: "9px", color: "hsl(0,0%,35%)", fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase" }}>{label}</span>

// AFTER
<span style={{ fontSize: "10px", color: "hsl(0,0%,35%)", fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase" }}>{label}</span>
```

**Change 4** — VOL label (line ~508):
```tsx
// BEFORE
<span style={{ fontSize: "9px", color: "hsl(0,0%,35%)", fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase" }}>VOL</span>

// AFTER
<span style={{ fontSize: "10px", color: "hsl(0,0%,35%)", fontFamily: "monospace", letterSpacing: "0.2em", textTransform: "uppercase" }}>VOL</span>
```

---

- [ ] **A3 — Fix C2 + C1: Mobile bar — text floor + touch targets**

Find the mobile bottom bar section (starts around line 516, comment: `{/* Mobile bottom bar */}`).

Replace the entire Controls div (the one with `flex items-center gap-1 px-3`) with:

```tsx
{/* Controls */}
<div className="flex items-center gap-0.5 px-3"
  style={{ minHeight: 68, paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}>
  <img src={current.art} alt={current.title} className="w-8 h-8 object-cover border border-border shrink-0" />
  <div className="flex-1 min-w-0 px-1">
    <p className="text-[10px] text-primary truncate font-medium">{current.title}</p>
    <p className="text-[10px] text-muted-foreground tracking-widest truncate">SUBSPACE RESONATOR</p>
  </div>
  <button onClick={() => seekBy(-10)} className="w-11 h-11 flex items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors shrink-0"
    style={transportBtnStyle} aria-label="Rewind 10 seconds">
    <Rewind size={12} />
  </button>
  <button onClick={prevTrack} className="w-11 h-11 flex items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors shrink-0"
    style={transportBtnStyle} aria-label="Previous track">
    <SkipBack size={13} />
  </button>
  <button onClick={togglePlay} className="w-11 h-11 flex items-center justify-center border-2 border-border hover:border-primary hover:text-primary transition-colors shrink-0"
    style={{ background: playing ? "linear-gradient(180deg, hsl(210,100%,15%), hsl(210,100%,8%))" : "linear-gradient(180deg, hsl(0,0%,14%), hsl(0,0%,6%))", boxShadow: playing ? "inset 0 0 12px hsl(210 100% 50% / 0.15)" : "none" }}
    aria-label={playing ? "Pause" : "Play"}>
    {playing ? <Pause size={15} /> : <Play size={15} />}
  </button>
  <button onClick={nextTrack} className="w-11 h-11 flex items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors shrink-0"
    style={transportBtnStyle} aria-label="Next track">
    <SkipForward size={13} />
  </button>
  <button onClick={() => seekBy(10)} className="w-11 h-11 flex items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors shrink-0"
    style={transportBtnStyle} aria-label="Forward 10 seconds">
    <FastForward size={12} />
  </button>
</div>
```

Key changes from current: `gap-1` → `gap-0.5`, `minHeight: 56` → `minHeight: 68`, all `w-8 h-8` → `w-11 h-11`, `w-9 h-9` → `w-11 h-11`, `text-[8px]` → `text-[10px]` on artist label, added `truncate` to artist label.

---

- [ ] **A4 — Fix H3: Lazy mount playlist iframe**

At the top of `MusicPlayer` component body (after the existing `useState` declarations, around line 41), add:

```tsx
const [playlistMounted, setPlaylistMounted] = useState(false);
```

Find the tab strip button click handler (around line 328–341). Change the `onClick` from:
```tsx
onClick={() => setActiveTab(tab.key)}
```
to:
```tsx
onClick={() => {
  setActiveTab(tab.key);
  if (tab.key === "playlist") setPlaylistMounted(true);
}}
```

Find the playlist iframe (line ~316):
```tsx
<iframe ref={playlistIframeRef} src={playlistEmbedUrl} onLoad={handlePlaylistIframeLoad}
  width="0" height="0" allow="autoplay" className="hidden" title="SoundCloud Playlist Player" />
```

Wrap it in a conditional:
```tsx
{playlistMounted && (
  <iframe ref={playlistIframeRef} src={playlistEmbedUrl} onLoad={handlePlaylistIframeLoad}
    width="0" height="0" allow="autoplay" className="hidden" title="SoundCloud Playlist Player" />
)}
```

**Verify:** Open browser DevTools → Network tab. Filter by "soundcloud". Reload page. Confirm only ONE SoundCloud iframe request fires on load. Click "PLAYLISTS" tab — confirm the second iframe now loads.

---

- [ ] **A5 — Fix L2: Rename section heading**

Find line ~323:
```tsx
// BEFORE
<h2 className="text-xs tracking-[0.3em] text-primary mb-4 sm:mb-6 uppercase">
  // TRANSMISSION LOG
</h2>

// AFTER
<h2 className="text-xs tracking-[0.3em] text-primary mb-4 sm:mb-6 uppercase">
  // MUSIC ARCHIVE
</h2>
```

---

- [ ] **A6 — Visual verify in browser**

At `http://localhost:5173`, resize browser to mobile width (~375px). Check:
- Mobile player bar is taller (~68px)
- All 5 transport buttons appear and feel tappable (each ~44px)
- No text below 10px visible anywhere in the player
- Section heading reads "// MUSIC ARCHIVE"
- Click PLAYLISTS tab — playlist loads without error

---

- [ ] **A7 — Commit Alpha changes**

```powershell
git add src/components/MusicPlayer/MusicPlayer.tsx
git commit -m "fix: MusicPlayer — 44px mobile touch targets, 10px text floor, lazy playlist iframe, heading rename"
```

---

## Task B — Navigation + Global CSS `[Agent BETA]`

**Spec findings covered:** H1 (scroll spy active nav), M2 (touch-action)

**Files:**
- Modify: `src/components/SiteHeader.tsx`
- Modify: `src/index.css`

---

- [ ] **B1 — Start dev server**

```powershell
npm run dev
```

Open `http://localhost:5173`. Keep server running throughout.

---

- [ ] **B2 — Fix H1: Add IntersectionObserver scroll spy to SiteHeader**

Replace the entire content of `src/components/SiteHeader.tsx` with:

```tsx
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import heroLogo from "@/assets/bio-watermark.jpg";

const navItems = [
  { label: "MUSIC",   href: "#music" },
  { label: "LABELS",  href: "#labels" },
  { label: "BIO",     href: "#bio" },
  { label: "BOOKING", href: "#contact" },
  { label: "ARCHIVE", href: "#gallery" },
  { label: "CONNECT", href: "#connect" },
];

const SiteHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("music");

  useEffect(() => {
    const close = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  useEffect(() => {
    const sectionIds = navItems.map((item) => item.href.slice(1));
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { rootMargin: "-30% 0px -65% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMenuOpen(false);
    const el = document.querySelector<HTMLElement>(href);
    if (!el) return;
    const headerH = 56;
    const top = el.getBoundingClientRect().top + window.scrollY - headerH;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <header className="glass-header fixed top-0 left-0 right-0 z-50">
      <div className="container flex items-center h-14 gap-2">
        <a
          href="#hero"
          onClick={(e) => handleNav(e, "#hero")}
          aria-label="Subspace Resonator — back to top"
          className="min-h-[44px] flex items-center shrink-0"
        >
          <img src={heroLogo} alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
        </a>

        <div className="flex-1" />

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-0">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleNav(e, item.href)}
              className={`nav-link${item.href.slice(1) === activeSection ? " active" : ""}`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile navigation"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="md:hidden overflow-hidden border-t border-border"
            style={{ background: "hsla(0,0%,1%,0.95)" }}
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNav(e, item.href)}
                className={`nav-link w-full text-left px-6${item.href.slice(1) === activeSection ? " active" : ""}`}
              >
                {item.label}
              </a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};

export default SiteHeader;
```

---

- [ ] **B3 — Visual verify scroll spy**

At `http://localhost:5173`, on desktop (≥768px):
- On page load, "MUSIC" nav link should have blue underline (active)
- Slowly scroll down — as each section enters the viewport's upper third, its nav link activates
- Confirm LABELS, BIO, BOOKING, ARCHIVE, CONNECT each light up in order
- Verify mobile menu also shows active state when open during scroll

---

- [ ] **B4 — Fix M2: Add touch-action: manipulation to index.css**

In `src/index.css`, inside the `@layer base { }` block, after the `html { scroll-behavior: smooth; }` line, add:

```css
button,
a,
[role="button"],
[role="slider"] {
  touch-action: manipulation;
}
```

This eliminates the 300ms tap delay on Android browsers without affecting any other gesture behavior.

---

- [ ] **B5 — Commit Beta changes**

```powershell
git add src/components/SiteHeader.tsx src/index.css
git commit -m "fix: SiteHeader scroll spy active nav, touch-action manipulation global"
```

---

## Task C — Layout / Style / Accessibility `[Agent GAMMA]`

**Spec findings covered:** H4 (BookingSection CLS), H5 (box-shadow animation), M1 (body text size), M3 (booking button widths), M4 (external link aria-labels), L3 (Events link label)

**Files:**
- Modify: `src/components/BookingSection.tsx`
- Modify: `src/components/LabelPedigree.tsx`
- Modify: `src/components/SocialMatrix.tsx`

---

- [ ] **C1 — Start dev server**

```powershell
npm run dev
```

Open `http://localhost:5173`. Keep server running throughout.

---

- [ ] **C2 — Fix H4: BookingSection image dimensions (CLS prevention)**

In `src/components/BookingSection.tsx`, find the `<img>` tag for the live performance photo (line ~19):

```tsx
// BEFORE
<img
  src={liveAlpha}
  alt="Subspace Resonator performing live"
  className="w-full h-full object-cover scale-110"
  style={{ objectPosition: "50% 30%" }}
  loading="lazy"
/>

// AFTER
<img
  src={liveAlpha}
  alt="Subspace Resonator performing live"
  width={1920}
  height={1080}
  className="w-full h-full object-cover scale-110"
  style={{ objectPosition: "50% 30%" }}
  loading="lazy"
/>
```

---

- [ ] **C3 — Fix H5: Replace Framer box-shadow with filter on CTAs**

In `src/components/BookingSection.tsx`, find the three `<motion.a>` CTA elements and replace their `whileHover` props:

**Primary CTA (email — "INITIATE CONTACT"):**
```tsx
// BEFORE
<motion.a
  href="mailto:subspaceresonator@gmail.com"
  className="inline-flex items-center justify-center border border-primary text-primary text-xs tracking-[0.2em] uppercase px-8 min-h-[44px] hover:bg-primary hover:text-primary-foreground transition-colors w-fit"
  whileHover={{ boxShadow: "0 0 20px hsl(210 100% 50% / 0.4)" }}
>

// AFTER
<motion.a
  href="mailto:subspaceresonator@gmail.com"
  className="inline-flex items-center justify-center border border-primary text-primary text-xs tracking-[0.2em] uppercase px-8 min-h-[44px] hover:bg-primary hover:text-primary-foreground transition-colors w-full sm:w-fit"
  whileHover={{ filter: "drop-shadow(0 0 16px hsl(210 100% 50% / 0.5))" }}
  transition={{ duration: 0.2 }}
>
```

(Note: `w-fit` → `w-full sm:w-fit` is the M3 fix — applied to all three CTAs simultaneously.)

**Secondary CTA (phone — "FAST CHANNEL · CALL"):**
```tsx
// BEFORE
<motion.a
  href="tel:+972507974184"
  className="inline-flex items-center justify-center border border-border text-foreground text-xs tracking-[0.2em] uppercase px-8 min-h-[44px] hover:border-primary hover:text-primary transition-colors w-fit"
  whileHover={{ boxShadow: "0 0 20px hsl(210 100% 50% / 0.25)" }}
>

// AFTER
<motion.a
  href="tel:+972507974184"
  className="inline-flex items-center justify-center border border-border text-foreground text-xs tracking-[0.2em] uppercase px-8 min-h-[44px] hover:border-primary hover:text-primary transition-colors w-full sm:w-fit"
  whileHover={{ filter: "drop-shadow(0 0 12px hsl(210 100% 50% / 0.3))" }}
  transition={{ duration: 0.2 }}
>
```

**Secondary CTA (WhatsApp — "WHATSAPP · CHAT"):**
```tsx
// BEFORE
<motion.a
  href="https://wa.me/972507974184"
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center justify-center border border-border text-foreground text-xs tracking-[0.2em] uppercase px-8 min-h-[44px] hover:border-primary hover:text-primary transition-colors w-fit"
  whileHover={{ boxShadow: "0 0 20px hsl(210 100% 50% / 0.25)" }}
>

// AFTER
<motion.a
  href="https://wa.me/972507974184"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Contact via WhatsApp (opens in new tab)"
  className="inline-flex items-center justify-center border border-border text-foreground text-xs tracking-[0.2em] uppercase px-8 min-h-[44px] hover:border-primary hover:text-primary transition-colors w-full sm:w-fit"
  whileHover={{ filter: "drop-shadow(0 0 12px hsl(210 100% 50% / 0.3))" }}
  transition={{ duration: 0.2 }}
>
```

(Note: `aria-label` added here covers M4 for this link.)

---

- [ ] **C4 — Fix M1: Booking copy body text size on mobile**

In `src/components/BookingSection.tsx`, find the copy paragraph (line ~28):

```tsx
// BEFORE
<p className="text-sm leading-relaxed text-foreground mb-6">

// AFTER
<p className="text-base sm:text-sm leading-relaxed text-foreground mb-6">
```

---

- [ ] **C5 — Fix M4: Add new-tab disclosure to all SocialMatrix links**

In `src/components/SocialMatrix.tsx`, find the `<a>` element inside the `.map()` (around line 60):

```tsx
// BEFORE
<a
  key={s.name}
  href={s.url}
  target="_blank"
  rel="noopener noreferrer"
  className="section-border px-3 sm:px-5 min-h-[44px] flex items-center gap-2.5 text-[10px] sm:text-xs tracking-[0.15em] text-foreground hover:text-primary hover:border-primary transition-colors font-medium"
>
  <Icon />
  <span>{s.name}</span>
</a>

// AFTER
<a
  key={s.name}
  href={s.url}
  target="_blank"
  rel="noopener noreferrer"
  className="section-border px-3 sm:px-5 min-h-[44px] flex items-center gap-2.5 text-[10px] sm:text-xs tracking-[0.15em] text-foreground hover:text-primary hover:border-primary transition-colors font-medium"
>
  <Icon />
  <span>{s.name}</span>
  <span className="sr-only"> (opens in new tab)</span>
</a>
```

---

- [ ] **C6 — Fix L3: Rename Events → Live Events in SocialMatrix**

In `src/components/SocialMatrix.tsx`, find the socials array entry for the calendar link (around line 45):

```tsx
// BEFORE
{ icon: CalendarIcon, name: "Events",     url: "https://soundcloudevents.velvetcake.live/" },

// AFTER
{ icon: CalendarIcon, name: "Live Events", url: "https://soundcloudevents.velvetcake.live/" },
```

---

- [ ] **C7 — Visual verify Gamma changes**

At `http://localhost:5173`:
1. **Resize to 320px** — booking CTAs should stack vertically full-width
2. **Resize to 600px** — booking CTAs should be inline with `w-fit`
3. **Hover over "INITIATE CONTACT"** — confirm glow effect works (no box-shadow flicker, uses filter)
4. **Booking section image** — reload page, confirm no layout shift on the live photo
5. **Booking copy** — on mobile (~375px), text should appear slightly larger than before
6. **SocialMatrix** — confirm "Live Events" label, check DevTools accessibility tree to confirm "(opens in new tab)" is announced

---

- [ ] **C8 — Commit Gamma changes**

```powershell
git add src/components/BookingSection.tsx src/components/LabelPedigree.tsx src/components/SocialMatrix.tsx
git commit -m "fix: BookingSection CLS + GPU animation, booking buttons full-width mobile, a11y new-tab labels, Live Events rename"
```

---

## Task Q — QA Verification `[Agent QA — runs after A, B, C all committed]`

**Skill required:** `webapp-testing` (Playwright)

**Prerequisite:** Confirm all three commits from Tasks A, B, C are present:
```powershell
git log --oneline -5
```
Expected: see all three fix commits.

---

- [ ] **Q1 — Start dev server**

```powershell
npm run dev
```

Confirm `http://localhost:5173` responds with HTTP 200.

---

- [ ] **Q2 — Capture screenshots at 4 viewports**

Using the `webapp-testing` skill (Playwright), capture full-page screenshots at:
- 320×812 — label: `mobile-320`
- 390×844 — label: `mobile-390`
- 768×1024 — label: `tablet-768`
- 1280×800 — label: `desktop-1280`

For each viewport, scroll to:
1. Hero section (top)
2. Music player section
3. Bio section
4. Booking section
5. SocialMatrix section

---

- [ ] **Q3 — Run committee re-audit checklist**

Verify each finding is resolved. Mark PASS or FAIL with screenshot reference:

| Finding | Check | Expected |
|---------|-------|----------|
| C1 touch targets | Mobile bar buttons at 390px | Buttons visually ~44px tall, comfortable to tap |
| C2 text floor | Inspect any text in player | No text renders below 10px — check DevTools computed styles |
| H1 scroll spy | Scroll page on desktop | Active nav link underline follows scroll position |
| H2 skip link | Tab from address bar | First focusable element is "Skip to main content" |
| H3 lazy iframe | DevTools Network on load | Only 1 SoundCloud iframe request; 2nd fires after PLAYLISTS tab click |
| H4 CLS image | DevTools Performance → CLS | Booking section image not contributing to layout shift |
| H5 animation | Hover booking CTAs, inspect | `filter` in computed style, no `box-shadow` in Framer animation |
| M1 body text | Mobile 390px booking section | Copy paragraph visually larger (16px) |
| M2 touch-action | DevTools computed → button | `touch-action: manipulation` on all buttons/links |
| M3 button widths | Mobile 320px booking section | All 3 CTAs span full container width |
| M4 aria-labels | DevTools accessibility tree | WhatsApp link has aria-label; all SocialMatrix links announce "(opens in new tab)" |
| L2 heading | Music section | Reads "// MUSIC ARCHIVE" not "// TRANSMISSION LOG" |
| L3 events label | SocialMatrix | "Live Events" chip visible |

---

- [ ] **Q4 — Write audit report**

Create `docs/superpowers/qa/2026-06-04-uxaudit-qa-report.md` with:
- PASS/FAIL per finding
- Screenshot filenames as evidence
- Any regressions found in unmodified sections

---

- [ ] **Q5 — Commit QA report**

```powershell
git add docs/superpowers/qa/
git commit -m "docs: QA report — UX audit fixes verified"
```

---

## Self-Review Checklist

- [x] All 13 findings have a corresponding step (H2 was pre-applied by user, confirmed in App.tsx)
- [x] No TBD or placeholder steps — all code is complete and exact
- [x] Agent file ownership: A=MusicPlayer.tsx, B=SiteHeader.tsx+index.css, C=BookingSection+LabelPedigree+SocialMatrix — no overlaps
- [x] M3 (button widths) bundled into C3 (the whileHover step) since it modifies the same `<motion.a>` elements — not a gap
- [x] M4 for WhatsApp bundled into C3; M4 for SocialMatrix in C5 — both covered
- [x] Type signatures consistent throughout — no renamed functions between tasks
- [x] L1 (WebP) explicitly out of scope — not a gap, deferred by design
