# UX Audit Fixes — Full Sweep
**Date:** 2026-06-04  
**Priority:** Quality and safety of site and user  
**Scope:** 13 findings (H2 skip-link already applied manually)  
**Execution:** 3 parallel implementation agents + 1 QA/audit agent

---

## Context

A full UI/UX committee audit surfaced 13 remaining findings across CRITICAL, HIGH, MEDIUM, and LOW tiers. The user has delegated all decisions to the committee with quality and safety as the top priority. L1 (WebP image conversion) is deferred as a build-tooling follow-up and is NOT in scope for this sprint.

---

## Agent Map — Zero File Conflicts

Each agent owns a non-overlapping set of files. All three run in parallel. QA runs after all three complete.

```
Agent ALPHA  →  MusicPlayer.tsx
Agent BETA   →  SiteHeader.tsx + index.css
Agent GAMMA  →  BookingSection.tsx + LabelPedigree.tsx + SocialMatrix.tsx
Agent QA     →  Playwright screenshots + committee re-audit checklist
```

---

## Agent ALPHA — MusicPlayer Fixes

**File:** `src/components/MusicPlayer/MusicPlayer.tsx`

### C1 — Mobile transport button touch targets
**Problem:** Prev/next/rewind/forward buttons are `w-8 h-8` (32px). Play is `w-9 h-9` (36px). Both fail the 44×44pt minimum.  
**Fix:** Change all mobile bar buttons to `w-11 h-11` (44px). Play button to `w-12 h-12` (48px) to maintain visual hierarchy. Reduce icon sizes proportionally to keep visual weight balanced (icon size -1 step).

Current mobile bar structure:
```tsx
// All buttons: w-8 → w-11, w-9 → w-12 (play), icon sizes -1 step
<button className="w-11 h-11 ..."><Rewind size={13} /></button>
<button className="w-11 h-11 ..."><SkipBack size={14} /></button>
<button className="w-12 h-12 ..."><Play/Pause size={16} /></button>
<button className="w-11 h-11 ..."><SkipForward size={14} /></button>
<button className="w-11 h-11 ..."><FastForward size={13} /></button>
```

The mobile bar's `minHeight: 56px` will need to increase to `minHeight: 64px` to accommodate 44px buttons plus padding.

### C2 — Text size floor at 10px
**Problem:** `text-[7px]` on time timestamps, `text-[8px]` on mobile artist label.  
**Fix:** Floor ALL text in MusicPlayer at `text-[10px]`. Specific changes:
- Position/duration timestamps: `text-[7px]` → `text-[10px]`
- Mobile artist label "SUBSPACE RESONATOR": `text-[8px]` → `text-[10px]`
- Desktop `text-[8px]` and `text-[9px]` channel strip labels → `text-[10px]`

### H3 — Playlist iframe lazy mount
**Problem:** Both SoundCloud iframes initialize on mount regardless of active tab. The playlist iframe fires API requests and occupies a widget slot even if user never opens Playlists.  
**Fix:** Add `playlistMounted` state (boolean, default `false`). Set to `true` on first click of the PLAYLISTS tab. Only render `<iframe ref={playlistIframeRef} ...>` when `playlistMounted === true`. The `initPlaylistWidget` callback already handles deferred init correctly — just gate the iframe render.

```tsx
const [playlistMounted, setPlaylistMounted] = useState(false);
// On tab click:
if (tab.key === "playlist") setPlaylistMounted(true);
// In JSX:
{playlistMounted && <iframe ref={playlistIframeRef} ... />}
```

### L2 — Section heading rename
**Problem:** `// TRANSMISSION LOG` conflicts semantically with the removed SignalLog concept and doesn't match the nav label "MUSIC".  
**Fix:** Change to `// MUSIC ARCHIVE`.

---

## Agent BETA — Navigation + Global CSS

### H1 — Active nav scroll spy
**File:** `src/components/SiteHeader.tsx`  
**Problem:** No visual active state as user scrolls. The `.nav-link.active::after` CSS underline rule exists but is never activated.  
**Fix:** Add `IntersectionObserver` in `SiteHeader` watching all section IDs. Track `activeSection` state. Apply `active` class to matching nav link.

Implementation:
```tsx
const [activeSection, setActiveSection] = useState("hero");

useEffect(() => {
  const sections = ["hero", "music", "labels", "bio", "contact", "gallery", "connect"];
  const observers = sections.map((id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );
    obs.observe(el);
    return obs;
  });
  return () => observers.forEach((o) => o?.disconnect());
}, []);
```

Nav link gets `active` class when `href === "#${activeSection}`:
```tsx
className={`nav-link ${item.href === `#${activeSection}` ? "active" : ""}`}
```

### M2 — touch-action: manipulation (global)
**File:** `src/index.css`  
**Problem:** 300ms tap delay on interactive elements on older Android.  
**Fix:** Add to `@layer base`:
```css
button, a, [role="button"], [role="slider"] {
  touch-action: manipulation;
}
```

---

## Agent GAMMA — Layout, Style, Accessibility

### H4 — BookingSection image CLS
**File:** `src/components/BookingSection.tsx`  
**Problem:** `<img src={liveAlpha}>` has no intrinsic dimensions. Container height is CSS-constrained but image itself still causes layout shift.  
**Fix:** Add `width={1920} height={1080}` to the img element (matches live-alpha.jpg aspect ratio).

### H5 — Box-shadow → GPU-composited animation
**File:** `src/components/BookingSection.tsx` only  
**Problem:** BookingSection CTAs use `whileHover={{ boxShadow: "..." }}` — Framer Motion animating `box-shadow` directly triggers repaint on every frame.  
**Note:** LabelPedigree's glow is a Tailwind `hover:shadow-[...]` CSS class (not Framer-animated), which is acceptable — CSS hover transitions are browser-optimised. No change needed there.  
**Fix:** Replace Framer `boxShadow` with `filter: drop-shadow()` on all three BookingSection CTAs:
```tsx
// Primary CTA (email):
whileHover={{ filter: "drop-shadow(0 0 16px hsl(210 100% 50% / 0.5))" }}
// Secondary CTAs (phone, WhatsApp):
whileHover={{ filter: "drop-shadow(0 0 12px hsl(210 100% 50% / 0.3))" }}
```

### M1 — Body text floor for mobile readability
**File:** `src/components/BookingSection.tsx`  
**Problem:** Copy paragraph at `text-sm` (14px) is borderline on mobile with monospace font.  
**Fix:** `text-sm` → `text-base sm:text-sm` on the booking copy paragraph only. (BioSection body stays text-sm — the user's recent edit is acceptable at that size with leading-relaxed.)

### M3 — Booking button full-width on mobile
**File:** `src/components/BookingSection.tsx`  
**Problem:** `w-fit` on all 3 CTAs leaves orphaned left-aligned buttons on narrow screens.  
**Fix:** `w-fit` → `w-full sm:w-fit` on all three `<motion.a>` CTA elements.

### M4 — External link aria-labels (new-tab disclosure)
**Files:** `src/components/BookingSection.tsx`, `src/components/SocialMatrix.tsx`  
**Problem:** `target="_blank"` links don't disclose new-tab behavior to screen reader users.  
**Fix:**
- BookingSection WhatsApp: `aria-label="Contact via WhatsApp (opens in new tab)"`
- SocialMatrix: append `(opens in new tab)` to each link's `aria-label`. Since all SocialMatrix links open in new tab, add a visually-hidden `<span className="sr-only"> (opens in new tab)</span>` inside each `<a>` rather than modifying all aria-labels individually.

### L3 — Events link clarity
**File:** `src/components/SocialMatrix.tsx`  
**Problem:** "Events" label links to `soundcloudevents.velvetcake.live` — a third-party domain visitors won't recognize.  
**Fix:** Change label from `"Events"` to `"Live Events"` in the socials array. Add `aria-label="Live Events on Velvet Cake (opens in new tab)"` to that specific link.

---

## Agent QA — Verification & Re-Audit

Runs after all three implementation agents complete.

### Playwright Screenshot Suite
Capture screenshots at 4 viewports:
- 320px (small mobile)
- 390px (iPhone 14)
- 768px (tablet / md breakpoint)
- 1280px (desktop)

Key flows to screenshot:
1. Full page scroll (hero → footer)
2. Mobile player bar (verify 44px buttons visible)
3. Nav with active state (scroll to #bio, check LABELS highlighted)
4. Booking section (verify buttons full-width on 320px)
5. SocialMatrix (verify all links render)

### Committee Re-Audit Checklist
Re-verify each of the 13 findings is resolved:
- [ ] C1: Mobile buttons ≥44px (measure in screenshot)
- [ ] C2: No text below 10px anywhere
- [ ] H1: Active nav indicator visible while scrolling
- [ ] H3: Network tab shows no playlist iframe requests on initial load
- [ ] H4: No CLS on BookingSection image load
- [ ] H5: No box-shadow in Framer whileHover props
- [ ] M2: touch-action: manipulation in computed styles
- [ ] M1: Booking copy 16px on mobile
- [ ] M3: Booking buttons full-width at 320px
- [ ] M4: WhatsApp + SocialMatrix links have new-tab disclosure
- [ ] L2: Section heading reads "// MUSIC ARCHIVE"
- [ ] L3: Events entry reads "Live Events"

Report format: PASS / FAIL per item with screenshot reference.

---

## Safety Notes

- All changes are non-destructive (no data deleted, no personal info added/removed)
- Booking contact methods (email, phone, WhatsApp) unchanged
- No changes to SEO metadata, JSON-LD schema, or canonical URLs
- SocialMatrix personal links unchanged (no link additions or removals)
- Playlist lazy-mount is backward-compatible — first tab click triggers identical behavior to before

---

## Out of Scope (Deferred)

- **L1 — WebP conversion:** Requires `vite-plugin-imagemin` or `sharp` build pipeline. Separate sprint.
- **Gallery image dimensions:** Gallery images loaded from siteContent.ts array — would require updating all 21 entries. Separate task.
