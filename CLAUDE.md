# Subspace Resonator — Landing Page

Artist landing page for **Subspace Resonator** (Goa / Psychedelic Trance producer).
Production URL: https://subspaceresonator.com/
GitHub: https://github.com/yannigi3683-Git/subspace-resonator-landing

---

## Git & Branch Safety (read first)

`master` auto-deploys to production, so branch hygiene is not optional here.

1. CHECK BRANCH FIRST. Before the first edit of any task, run `git rev-parse --abbrev-ref HEAD`. If the change is unrelated to that branch's purpose, STOP and do not edit yet.
2. ONE FEATURE = ONE BRANCH off master. For any new or unrelated change, run `git switch master && git pull --ff-only && git switch -c feat/<slug>` BEFORE touching code. Never commit unrelated work onto an active feature branch (for example, the "quick access links" work must never land on `feat/radio-room`).
3. CONFIRM WHERE A COMMIT LANDED. After committing, run `git branch --contains HEAD` and `git log --oneline -1`. Work that lives only on one branch is not safe until it is merged to master or backed up elsewhere. When a change "is not showing," suspect branch/git state before re-debugging code.
4. BEFORE rewinding history (stash, rebase, reset --hard, branch rewind), run `git log --oneline master..HEAD` and rescue any commit unique to that branch first. A rewind silently drops commits from the working tree.
5. PowerShell 5.1 gotcha: NEVER gate on `if ($?)` after `... 2>&1 | Out-Null` on a native command (git, npm). They write normal status to stderr, which flips `$?` to false and silently skips the block. Gate on `$LASTEXITCODE -eq 0`, or mute one stream with `2>$null`. Never pipe native stderr into the pipeline just to silence it.

Each feature is a first-class isolated unit: its own branch plus its own spec/plan/qa docs under `docs/superpowers/`. Do not interleave two features' code, commits, or docs.

---

## Tech Stack

- **React 19** + **TypeScript 6** + **Vite 8** (Rolldown-based; MPA build with two entries: `index.html` landing + `radio.html` radio)
- **Tailwind CSS v3** (not v4)
- **Supabase** (`@supabase/supabase-js`, client in `src/lib/supabase.ts`, null-safe when env vars absent) — used by the Radio feature; project `lgcmbmlapksmdbkhkyyv`
- **Framer Motion** — animations and hover effects
- **react-helmet-async** — dynamic `<head>` tags (SEO, Open Graph)
- **lucide-react** — icons (never use emoji as icons)
- **Fonts:** Space Grotesk (headings), Inter (body), JetBrains Mono (mono/labels)
- **Test runner:** Vitest — all tests must pass before publishing; the count only grows (2026-06-12 baseline: 18 files, 64 tests)

---

## Commands

```
npm run dev       # dev server at localhost:5173
npm run build     # tsc -b && vite build  (TypeScript + bundle)
npm run test      # vitest (watch mode; use `npx vitest run` for single pass)
npm run lint      # eslint
npm run preview   # preview production build
```

Always run `npm run build` and `npm test` before pushing. Both must exit clean.

---

## Deployment

Hosted on **Vercel**. Production URL: https://subspaceresonator.com/

- **Auto-deploy is connected** (as of 2026-06-12): GitHub repo `yannigi3683-Git/subspace-resonator-landing` is linked in Vercel. Pushing to **`master`** auto-builds and deploys to production. Production branch is `master` (Vercel Settings -> Environments -> Production -> Branch Tracking).
- **Manual deploy** (if ever needed): `npx vercel --prod` from the project root (CLI is linked via `.vercel/project.json`, authed as `yannigi3683-git`). Do not use `--prebuilt` (ships stale local `.vercel/output`).
- **Verify a deploy shipped:** `curl -s "https://subspaceresonator.com/?cb=$(date +%s)" | grep -c "og:"` — a healthy production HTML has ~12 `og:` tags. Zero means a stale/old build is being served.
- **History / caution:** before 2026-06-12, this project was deployed only via the Vercel CLI and pushes did NOT deploy. Production silently served a stale build for ~5 commits (OG tags, GA4, WebP all appeared "broken" but were simply never shipped). If a change is not showing live, suspect the deploy before re-editing code. See the `debugging-stale-deployments` skill.
- The Vercel MCP/automation is signed into a different Vercel account (returns 404/403 for this project); use the CLI as the owner, not the MCP, to deploy.

---

## Page Structure

`src/App.tsx` assembles sections in this order:

```
<SiteHeader />       fixed nav, scroll-spy active state
<HeroSection />      hero with logo + visualizer
<MusicPlayer />      SoundCloud iframe player (see below)
<LabelPedigree />    label logos: Goa Records, Timewarp, Geomagnetic, Spiral Trax
<SignalLog />        discography ledger (// MUSIC ARCHIVE) — 6 releases, monospace grid
<BioSection />       artist bio (3 blocks: Signal, Reactivation, Mission)
<BookingSection />   contact / booking CTAs
<GallerySection />   photo archive, rAF auto-scroll + lightbox
<SocialMatrix />     all platform links
<Footer />
<AccessibilityMenu />  floating accessibility controls
```

---

## Component Map

| File | Responsibility |
|------|---------------|
| `src/App.tsx` | Root layout + all Helmet SEO tags + both JSON-LD blocks |
| `src/components/SiteHeader.tsx` | Fixed header, IntersectionObserver scroll-spy nav |
| `src/components/HeroSection.tsx` | Hero with HeroVisualizer |
| `src/components/HeroVisualizer.tsx` | Canvas-based visualizer |
| `src/components/MusicPlayer/MusicPlayer.tsx` | Full music player (desktop rack + mobile bar) |
| `src/components/MusicPlayer/SpectrumAnalyzer.tsx` | Spectrum bars (desktop only) |
| `src/components/MusicPlayer/FloodlightSet.tsx` | VU-meter floodlights (desktop only) |
| `src/components/MusicPlayer/Knob.tsx` | Volume knob (role=slider, keyboard/wheel/drag) |
| `src/components/LabelPedigree.tsx` | Label logo grid |
| `src/components/SignalLog.tsx` | Discography ledger (// MUSIC ARCHIVE) — date-led monospace grid, `id="archive"`. Quick access links: each release row is a whole-row link to its Bandcamp/Spotify page (ArrowUpRight hover affordance, focus ring, `release_click` GA4 event). Rows without a url stay non-interactive. |
| `src/lib/analytics.ts` | `trackEvent()` wrapper for GA4 — no-ops safely without gtag (tests, ad blockers) |
| `src/components/BioSection.tsx` | Bio (watermark bg) |
| `src/components/BookingSection.tsx` | Booking image + 3 CTAs |
| `src/components/GallerySection.tsx` | Gallery, lightbox |
| `src/components/SocialMatrix.tsx` | Social links grid |
| `src/components/Footer.tsx` | Footer — rendered inline in App.tsx; this file exists but is not imported (dead code) |
| `src/components/AccessibilityMenu.tsx` | A11y floating panel |

Each component has a matching `.test.tsx` file in the same folder.

---

## Music Player Details

Two SoundCloud iframes — tracks iframe (always mounted) and playlist iframe (lazy-mounted on first PLAYLISTS tab click via `playlistMounted` state).

**Track filter** — these tracks are deliberately excluded from the track list by regex in `initWidget()`:
- `/return to goa/i`
- `/old school night/i`
- `/al\s*titosh|sukkot\s*2024/i`

**Playlists defined:**
- 1998-2025 playlist
- DJ SETS playlist
- GEOMAGNETIC label playlist

Mobile bar buttons: all `w-11 h-11` (44px, meets touch-target minimum). Desktop uses `min-w-[34-48px]` range.

---

## Artist Identity

- **Artist name:** Subspace Resonator
- **Real name:** Yanni
- **Genre:** Goa Trance, Psychedelic Trance
- **Active since:** 1998 (Israeli underground scene)
- **Booking email:** subspaceresonator@gmail.com
- **Production email / contact:** yannigi3683@gmail.com

**Voice rules for copy:**
- No em dashes (—) in any user-visible text. Use periods, commas, or hyphens. Em dashes read as AI-generated.
- Copy is terse, technical, underground — not mainstream-friendly or algorithm-chasing.

---

## Confirmed Discography

All structured data must match this list exactly. Do not add unreleased tracks.

**Solo releases:**
| Title | Type | Label | Date |
|-------|------|-------|------|
| The Subspace Theory | EP (4 tracks) | Goa Records | 2025-12-26 |
| Galaxy 604 | Single | Goa Records | 2025 |
| Nightmare In Heaven | Single | Timewarp Records | 2025-10-31 |

**Compilation appearances:**
| Compilation | Label | Track | Date |
|-------------|-------|-------|------|
| The Call Of Goa, Vol. 5 | Timewarp Records | Subspace Disturbance | 2026 |
| Psychedelic Goa Trance 2026 100 Aliens | Fresh Frequencies | Galaxy 604 | 2026-01-09 |
| Psy Trance 2026 Space DJ | Fresh Frequencies | Galaxy 604 | 2026 |

**Unreleased (debut album in production) — DO NOT add to structured data:**
- Defying Gravity
- Quantum Mechanics
- Interstellar Future

---

## Social URLs (exact — verify before editing)

| Platform | URL |
|----------|-----|
| SoundCloud | https://soundcloud.com/subspaceresonance |
| Bandcamp | https://yannig.bandcamp.com/ |
| Spotify | https://open.spotify.com/artist/0UQWUdUuQ3NhMCACj4UXlk |
| Beatport | https://www.beatport.com/artist/subspace-resonator/1354950 |
| YouTube | https://www.youtube.com/@SubspaceResonator |
| Facebook | https://www.facebook.com/profile.php?id=61559198105695 |
| Instagram | https://www.instagram.com/subspace_resonator |
| TikTok | https://www.tiktok.com/@subspace.resonato (note: no trailing 'r') |
| Discogs | https://www.discogs.com/artist/15101171-Subspace-Resonator |
| Linktree | https://linktr.ee/yanni_subspace_resonator |
| Live Events | https://soundcloudevents.velvetcake.live/ |

---

## SEO

### Meta tags (in App.tsx Helmet)
All standard OG, Twitter Card, og:locale, og:site_name, og:image:alt, og:image:secure_url, og:image:secure_url, robots:index,follow.

### JSON-LD — Block 1: MusicGroup
Entity IRI (critical — used for cross-block linking): `https://subspaceresonator.com/#artist`

All `byArtist` fields in the releases block use `{ "@id": "https://subspaceresonator.com/#artist" }` to link back to this entity. Do not inline the artist name in byArtist — always use the `@id` reference.

### JSON-LD — Block 2: Releases @graph
Six MusicAlbum entries in a single `@graph` array. schema.org has no `EPAlbum` type — The Subspace Theory EP uses `StudioAlbum` (closest available). Compilation appearances use `byArtist` on the `track` (MusicRecording), not on the album.

### Known JSON-LD limitations (intentional)
- **Galaxy 604** has no `url` field — the Spotify track URL was removed because it's a track URL, not a release URL. A Spotify album URL was not available. Restore when confirmed.
- **`logo` field removed** from MusicGroup — og-image.jpg is 1200x630 landscape. Google Knowledge Panel requires near-square. Do not add back until a square logo asset exists.

### Static fallback (index.html)
`index.html` has a static title, description, and apple-touch-icon for non-JS crawlers (Twitterbot, LinkedIn, Slack). The `apple-touch-icon` points to `/apple-touch-icon.png` (180x180 opaque square PNG, generated from favicon.svg).

### After each deploy
1. Update `public/sitemap.xml` `lastmod` to the deploy date.
2. Submit sitemap to Google Search Console: https://search.google.com/search-console
3. Run Google Rich Results Test on the live URL.

---

## Assets

| File | Notes |
|------|-------|
| `public/og-image.jpg` | 1200x630, used for OG meta tags (crawlers only) |
| `public/apple-touch-icon.png` | 180x180 opaque square PNG, #0E0E10 bg, SR monogram — generated from favicon.svg via sharp |
| `public/favicon.svg` | SVG favicon |
| `public/robots.txt` | Allow all, sitemap pointer |
| `public/sitemap.xml` | Single-page sitemap, update lastmod after each deploy |
| `src/assets/bio-watermark.webp` | Watermark overlay in BioSection + nav logo (converted from JPG) |
| `src/assets/live-alpha.webp` | Live performance photo in BookingSection + full-page bg (converted from JPG) |
| `src/assets/art-subspace-theory.webp` | EP artwork, used as MusicPlayer art fallback (converted from JPG) |
| `src/assets/label-*.png` | Official label logos (Goa Records, Timewarp, Geomagnetic, Spiral Trax) |
| `src/assets/gallery-01..23.webp` | Gallery photos (23 images, converted from JPG to WebP) |

---

## Coding Conventions

- **No comments** unless the WHY is non-obvious. Never comment WHAT the code does.
- **No abstractions beyond task scope.** Fix the bug, don't refactor the file.
- **Tailwind for layout/spacing/color.** Inline styles only for dynamic values (e.g., computed positions, CSS variables via `hsl(var(--primary))`).
- **Framer Motion** for meaningful transitions. No decorative-only animation. `transform`/`opacity` only — never animate `width`, `height`, `box-shadow` directly (use `filter: drop-shadow()` instead).
- **touch-action: manipulation** is already set globally on buttons, anchors, sliders in `index.css`.
- **Minimum touch target:** 44px (`w-11 h-11` or `min-h-[44px]`). Never go below this on interactive elements.
- **Text floor:** 10px minimum in all UI. Never use `text-[7px]` or `text-[8px]` in production UI.
- **`section-border`** is the project's standard bordered box class (defined in index.css).
- **`glass-header`** is the fixed nav backdrop class.
- TypeScript strict mode. No `any` unless wrapping a third-party API (SoundCloud SC widget).

---

## Analytics

GA4 is wired up via `src/lib/analytics.ts`. The `trackEvent(action, params)` function wraps `window.gtag()` and no-ops safely when gtag is absent (Vitest, ad blockers).

Conversion events tracked:
- `booking_click` — `{ method: "email" | "phone" | "whatsapp" }` (BookingSection.tsx)
- `social_click` — `{ platform: string }` (SocialMatrix.tsx)
- `music_play` — `{ source: "tracks" | "playlist" }` (MusicPlayer.tsx)
- `release_click` — `{ title: string }` (SignalLog.tsx)

To verify events live: GA4 → Realtime → DebugView, then interact on the site. Aggregated data lands in 24-48h.

---

## Known Future Tasks (not yet built)

- **Galaxy 604 Spotify album URL** — find the album-level URL (not track URL) and add back to the Galaxy 604 MusicAlbum JSON-LD entry.
- **Debut album JSON-LD** — add structured data once the album is released.

---

## Docs

- `docs/superpowers/specs/` — design specs from brainstorming sessions
- `docs/superpowers/plans/` — implementation plans

Key specs on record:
- `2026-06-04-seo-optimization-design.md` — full SEO sweep spec (implemented)
- `2026-06-04-uxaudit-fixes-design.md` — 13-finding UX audit (implemented)
- `2026-06-13-quick-access-links-design.md` — clickable Music Archive release rows (implemented)
