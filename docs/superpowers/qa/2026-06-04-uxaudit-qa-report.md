# QA Report — UX Audit Fixes
**Date:** 2026-06-04  
**Auditor:** QA Agent (Claude Code)  
**Scope:** 13 UI/UX audit findings, code-inspection only

---

## Findings

### C1 — Mobile transport buttons ≥44px
**PASS** — `MusicPlayer.tsx` lines 541–561: all 5 mobile transport buttons (Rewind, Prev, Play/Pause, Next, FastForward) carry `w-11 h-11` (44×44 px). Example: line 541 `className="w-11 h-11 flex items-center justify-center ..."`.

---

### C2 — No text below 10px in MusicPlayer
**PASS** — grep for `text-[7px]`, `text-[8px]`, `text-[9px]`, `fontSize: "7px"/"8px"/"9px"` returns no matches in `MusicPlayer.tsx`. Smallest text classes present are `text-[10px]` and `text-xs`.

---

### H1 — Active nav scroll spy
**PASS** — `SiteHeader.tsx`:
- `activeSection` state initialised at line 17.
- `IntersectionObserver` useEffect at lines 25-54 observes each section and calls `setActiveSection(id)` on intersection.
- Nav links apply conditional class at line 87: `` className={`nav-link${item.href.slice(1) === activeSection ? " active" : ""}`} ``

---

### H2 — Skip-to-content link
**PASS** — `App.tsx`:
- Line 70: `<a href="#main-content" className="skip-link">Skip to main content</a>`
- Line 74: `<main id="main-content">`

Both anchor and target are present.

---

### H3 — Playlist iframe lazy mount
**PASS** — `MusicPlayer.tsx`:
- `playlistMounted` state declared at line 43.
- Playlist `<iframe>` wrapped at lines 317-320: `{playlistMounted && (<iframe ref={playlistIframeRef} ...`)}`
- Mount is triggered only when user clicks the PLAYLISTS tab (line 339).

---

### H4 — BookingSection image has width/height
**PASS** — `BookingSection.tsx` lines 19-20:
```tsx
width={1920}
height={1080}
```
Both attributes present on the `<img>` element.

---

### H5 — No Framer box-shadow animation
**PASS** — `BookingSection.tsx`: all three `whileHover` props use `filter: "drop-shadow(...)"` exclusively (lines 38, 46, 57). No `boxShadow` property appears in any `whileHover` or `animate` prop in this file.

---

### M1 — Booking body text 16px on mobile
**PASS** — `BookingSection.tsx` line 30:
```tsx
<p className="text-base sm:text-sm leading-relaxed text-foreground mb-6">
```
`text-base` (16 px) is the mobile default; `sm:text-sm` (14 px) applies at ≥640 px breakpoint.

---

### M2 — touch-action: manipulation
**PASS** — `src/index.css` lines 36-41, inside `@layer base`:
```css
button,
a,
[role="button"],
[role="slider"] {
  touch-action: manipulation;
}
```

---

### M3 — Booking CTAs full-width on mobile
**PASS** — `BookingSection.tsx`: all 3 `<motion.a>` CTAs include `w-full sm:w-fit`:
- Line 37 (INITIATE CONTACT)
- Line 45 (FAST CHANNEL · CALL)
- Line 56 (WHATSAPP · CHAT)

---

### M4 — New-tab disclosure on external links
**PASS (both sub-items)**

- **BookingSection.tsx** line 55: WhatsApp link has `aria-label="Contact via WhatsApp (opens in new tab)"`.
- **SocialMatrix.tsx** line 69: every social link in the map includes `<span className="sr-only"> (opens in new tab)</span>`.

---

### L2 — Heading renamed
**PASS** — `MusicPlayer.tsx` line 326:
```tsx
<h2 className="text-xs tracking-[0.3em] text-primary mb-4 sm:mb-6 uppercase">
  // MUSIC ARCHIVE
</h2>
```
Text is `// MUSIC ARCHIVE`, not `// TRANSMISSION LOG`.

---

### L3 — Events renamed
**PASS** — `SocialMatrix.tsx` line 45:
```tsx
{ icon: CalendarIcon, name: "Live Events", url: "https://soundcloudevents.velvetcake.live/" },
```
Entry uses `name: "Live Events"`, not `"Events"`.

---

## Summary

| Total | PASS | FAIL |
|-------|------|------|
| 13    | 13   | 0    |

**All 13 UX audit findings are correctly resolved.** No regressions or unexpected changes observed during inspection.

### Incidental observations (no action required)
- `SiteHeader.tsx` also applies the `active` class to mobile nav links (line 124), which was not part of the checklist but is a welcome consistency.
- The `<a href="#main-content">` skip link uses the `.skip-link` CSS class (defined in `index.css` lines 52-67) which positions it off-screen until focused — correct pattern.
- Footer email/phone links are plain `<a>` tags without `(opens in new tab)` disclosures, but they are `mailto:` / `tel:` schemes (not external URLs), so no sr-only label is needed there.
