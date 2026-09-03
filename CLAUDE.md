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
- **Test runner:** Vitest — all tests must pass before publishing; the count only grows, except when a feature is intentionally removed (2026-07-31 baseline: 60 files, 488 tests — the `api/importExtensions.test.ts` import guard on top of the 2026-07-30 deep-buffer status badge; GIFs were dropped earlier after Tenor's API shutdown, taking their 6 tests with them)

---

## Commands

```
npm run dev       # dev server at localhost:5173
npm run build     # tsc -b && vite build  (TypeScript + bundle)
npm run test      # vitest (watch mode; use `npx vitest run` for single pass)
npm run preview   # preview production build
```

Always run `npm run build` and `npm test` before pushing. Both must exit clean.

**There is no linter, and that is deliberate (decided 2026-07-31).** `package.json` used to declare `"lint": "eslint ."`, but eslint was never installed and no config was ever committed, so the command failed on every branch from day one. An audit of all 296 commits found that a stock ESLint config would have caught **none** of this repo's real bugs, and that `react-hooks/exhaustive-deps` would have argued *for* the shape that caused `b64604f` (the crossfade interval killed by its own effect cleanup — `phase` was correctly in the dep array, and that was the bug). `tsconfig.*.json` already enforces `strict`, `noUnusedLocals`, `noUnusedParameters` and `noFallthroughCasesInSwitch`, so the type checker covers the overlap. The one mechanically-detectable defect in the history — a missing `.js` on an `api/` relative import, which shipped three times (`974ced0`, `082971f`, `be01237`) — is now guarded by `api/importExtensions.test.ts` in the normal test run. Do not re-add the lint script without new evidence.

---

## Deployment

Hosted on **Vercel**. Production URL: https://subspaceresonator.com/

- **Auto-deploy is connected** (as of 2026-06-12): GitHub repo `yannigi3683-Git/subspace-resonator-landing` is linked in Vercel. Pushing to **`master`** auto-builds and deploys to production. Production branch is `master` (Vercel Settings -> Environments -> Production -> Branch Tracking).
- **Manual deploy** (if ever needed): `npx vercel --prod` from the project root (CLI is linked via `.vercel/project.json`, authed as `yannigi3683-git`). Do not use `--prebuilt` (ships stale local `.vercel/output`).
- **Cache headers live in `vercel.json`, and the two rules are not interchangeable.** `/assets/(.*)`
  is `public, max-age=31536000, immutable` because Vite stamps a content hash into those filenames,
  so a changed file is always a changed name. Everything else keeps `max-age=0, must-revalidate` via
  the catch-all block, which is what lets a new `index.html` be picked up instantly. Never widen the
  immutable rule past `/assets/` — an immutable `index.html` would pin visitors to a stale build with
  no way to push them off it. Verify after a deploy:
  `curl -sI https://subspaceresonator.com/assets/<new-hash>.js | grep -i cache-control`
- **Verify a deploy shipped:** `curl -s "https://subspaceresonator.com/?cb=$(date +%s)" | grep -c "og:"` — a healthy production HTML has ~12 `og:` tags. Zero means a stale/old build is being served.
- **Verify the API shipped too** (the HTML check above passes while the radio is stone dead): `npm run check:api` (add a URL argument to check a preview: `npm run check:api -- <preview-url>/api/rtc-session`). Prints `API ALIVE` on 401, which is the healthy answer for a tokenless request; `API BROKEN` on anything else, meaning the function is not booting and host + listeners are both down. Source: `scripts/check-api.mjs`. Read the reason with `npx vercel logs <deployment-url>` while re-running the check in another window; the log only tails live traffic.
- **Roll back a broken production deploy:** `npx vercel rollback <last-good-deployment-url> --yes` (find it with `npx vercel ls`). Takes ~30s and beats debugging a live outage. Used 2026-07-26 when `08f36fe` shipped an API that 500ed on every request.
- **A rollback PINS the domain — you must promote to release again.** After a rollback, later merges to `master` still build and still show as `Production` in `vercel ls`, but `subspaceresonator.com` stays aliased to the rolled-back deployment. Three merges looked "shipped" for an hour on 2026-07-26 while the browser kept getting the old bundle. Finish every rollback with: `npx vercel promote <newest-deployment-url> --yes`. Confirm the alias actually moved (`npx vercel inspect <url>` must list `subspaceresonator.com` under Aliases) and that the served bundle hash changed: `curl -s https://subspaceresonator.com/radio.html | grep -o '/assets/radio-[A-Za-z0-9_-]*\.js'`.
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

## Site Content Admin (`src/components/admin/`)

The landing page is no longer hardcoded. Text, socials, discography, gigs, booking details
and the gallery are read from Supabase at startup by `src/lib/siteContent.ts` (`hydrate()` is
called at module top level, line ~340, so **every visitor issues a `site_content` select before
first paint**) and edited in-browser through `AdminPanel.tsx`.

- **Storage:** one row, `site_content` table, `id = 'singleton'`, whole config as a JSON `data`
  column. Gallery images live in the Supabase Storage bucket `gallery`.
- **Opening it:** Ctrl+Shift+A anywhere on the landing page, then e-mail/password sign-in;
  authorisation is `supabase.rpc('has_role', ...)`, the same RPC the radio console uses.
- **The panel ships in the entry chunk to every visitor.** It is statically imported at
  `App.tsx:15` and rendered unconditionally at `App.tsx:118`. The Ctrl+Shift+A gate and the
  sign-in form are cosmetic: the table names, field names and form markup are readable by
  anyone who opens the bundle. **All real protection is RLS on `site_content` and on the
  `gallery` bucket.** Audit those the way the radio tables are audited (see the `pg_policies`
  query in the Subspace Radio section) — anon must have read and nothing else, and a single
  PERMISSIVE policy with a bare `true` cancels every strict policy beside it.
- Route-splitting the panel out of the entry chunk is a worthwhile bundle win but is **defence
  in depth, not a substitute for RLS**. It needs the Ctrl+Shift+A listener lifted out of
  `AdminPanel` first, since the component currently owns its own trigger.
- The panel's 22 inputs have no `htmlFor`/`id` association, no `autoComplete` and no
  `aria-invalid`/`role="alert"` error wiring. **Deliberately not fixed** (2026-08-28): it is
  private and password-locked, and the IS 5568 accessibility audit scope is the public page,
  which still has zero forms. Do not "fix" this as drive-by work.

## Music Player Details

Two SoundCloud iframes — tracks iframe (always mounted) and playlist iframe (lazy-mounted on first PLAYLISTS tab click via `playlistMounted` state).

**Track filter** — these tracks are deliberately excluded from the track list by regex in `initWidget()`:
- `/return to goa/i`
- `/old school night/i`
- `/al\s*titosh|sukkot\s*2024/i`

**Playlists defined:** (first entry is the default tab; `SC_PLAYLIST_URL` derives from `DEFAULT_PLAYLIST_KEY`)
- The Continuum album playlist (default)
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
- **`logo` field removed** from MusicGroup — og-image.jpg is 1824x1216 landscape. Google Knowledge Panel requires near-square. Do not add back until a square logo asset exists.

### Static fallback (index.html)
`index.html` has a static title, description, and apple-touch-icon for non-JS crawlers (Twitterbot, LinkedIn, Slack). The `apple-touch-icon` points to `/apple-touch-icon.png` (180x180 opaque square PNG, generated from favicon.svg).

### After each deploy
1. **Only if the deploy changed what a visitor sees** on a page listed in `public/sitemap.xml`, set that page's `lastmod` to today. `lastmod` means "when this page's content last changed", NOT "when the site was last deployed" — a deploy that only touches the restreamer, host-console internals, docs, tests or tooling changes nothing a crawler cares about, so leave `lastmod` alone. An untrue `lastmod` is worse than an old one: crawlers discount the signal from sites that bump it every deploy, which costs you the signal on the day the page really does change. (`/` sitting at an old date is correct, not stale, until the landing page itself changes.)
2. Steps 3-4 only apply when step 1 actually fired. A radio-only or docs-only deploy is finished here.
3. Submit sitemap to Google Search Console: https://search.google.com/search-console
4. Run Google Rich Results Test on the live URL.

---

## Assets

| File | Notes |
|------|-------|
| `public/og-image.jpg` | 1824x1216, ~241KB, used for OG meta tags (crawlers only). `og-radio.jpg` is currently a byte-identical copy. Keep both under 250KB: several link scrapers cap the bytes they fetch and render no preview above their limit. The `og:image:width`/`height` tags in `index.html`, `radio.html` and `App.tsx` must match the real pixels. |
| `public/apple-touch-icon.png` | 180x180 opaque square PNG, #0E0E10 bg, SR monogram — generated from favicon.svg via sharp |
| `public/favicon.svg` | SVG favicon |
| `public/robots.txt` | Allow all, sitemap pointer |
| `public/sitemap.xml` | Lists `/`, `/privacy`, `/accessibility`. **`/radio` is deliberately absent and `radio.html` is `noindex, follow`** — the station is invite-only, so it must stay reachable by link but out of search. Never use a robots.txt `Disallow` for this: that would also stop crawlers reading the noindex. |
| `src/assets/bio-watermark.webp` | Watermark overlay in BioSection + nav logo (converted from JPG) |
| `src/assets/live-alpha.webp` | Live performance photo in BookingSection + full-page bg (converted from JPG) |
| `src/assets/art-subspace-theory.webp` | EP artwork, used as MusicPlayer art fallback (converted from JPG) |
| `src/assets/label-*.png` | Official label logos (Goa Records, Timewarp, Geomagnetic, Spiral Trax) |
| `src/assets/gallery-01..23.webp` | Gallery photos (23 images, converted from JPG to WebP) |

---

## Coding Conventions

- **Keep docs in sync.** Any change to behavior, flow, config, or assets must update the relevant `.md` (CLAUDE.md, README, HOW-TO-RUN, guide docs) in the same task. A change is not done until its docs match.
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

**Cookie consent (Google Consent Mode v2):** GA loads on every page but starts `denied` (cookieless) — `index.html` calls `gtag('consent','default',{... analytics_storage:'denied', wait_for_update:500})` before `config`, and upgrades to `granted` on load if `localStorage['cookie-consent-v1'] === 'granted'`. The non-blocking `CookieConsent.tsx` banner (rendered in `App.tsx`) writes that key via `src/lib/consent.ts` and calls `gtag('consent','update',{analytics_storage:'granted'})` on Accept. Decline stays cookieless. No `_ga*` cookie is set until Accept. `radio.html` still loads GA unconditionally (out of the landing-only compliance scope).

---

## Legal / Compliance (Israeli law — landing page)

Landing page audited against IS 5568 AA (accessibility), spam law (amendment 40), and privacy law (amendment 13). Scope was **landing page only, English only**; `/radio` is deliberately out of scope (invite-only during a live broadcast).

- **Two legal pages**, rendered from the main `index.html` entry via a pathname branch in `src/main.tsx` (no router lib): `/accessibility` → `src/pages/AccessibilityStatement.tsx`, `/privacy` → `src/pages/PrivacyPolicy.tsx`. Routing: `radioRewrite` plugin in `vite.config.ts` (dev/preview) + `vercel.json` rewrites (prod) send both paths to `/index.html`. Linked from the footer (`App.tsx`) and, for the statement, from the accessibility widget (`AccessibilityMenu.tsx`).
- **Accessibility statement** names a coordinator (Yanni + `subspaceresonator@gmail.com` + phone), declares WCAG 2.1 AA / IS 5568, and describes the on-site widget. Update its `LAST_REVIEWED` date when the site's accessibility materially changes.
- **Privacy policy** discloses GA4 + Consent Mode; states the landing page collects no data via forms (booking is outbound `mailto:`/`tel:`/WhatsApp links only). Update `LAST_UPDATED` if data collection ever changes.
- **Spam law = N/A** — the site sends no marketing email/SMS and has no newsletter/signup. If a mailing list or contact form is ever added, revisit: separate unticked marketing-consent checkbox, consent logging, unsubscribe, sender ID, "advertisement" marking, and a privacy-consent checkbox before submit.
- The two MusicPlayer seek bars are `role="slider"` + `tabIndex=0` + arrow/Home/End keys (`handleProgressKey`), not click-only.

---

## Subspace Radio (`/radio`, `radio.html`)

Live browser radio in `src/radio/`. Host broadcasts from `radio.html#admin` (AdminConsole/GoLivePanel); listeners open `/radio` (LiveRoom). Transport = **Cloudflare Realtime SFU** (publisher → SFU → subscribers), signaling via `api/rtc-session.ts`; presence/chat/control via **Supabase** Realtime + RLS (project `lgcmbmlapksmdbkhkyyv`).

**`api/` import rule (an outage came from breaking it):** every relative import inside `api/` must carry the `.js` extension (`from './chatTranscript.js'`), even though the source is TypeScript. `package.json` is `"type": "module"` and Vercel's Node runtime does not bundle sibling files, so an extensionless specifier passes `tsc` and Vitest but makes the deployed function die on boot with `ERR_MODULE_NOT_FOUND` — every phase 500s, host and listeners alike. `api/*.test.ts` is in `.vercelignore` so tests are never deployed as public functions.

**Audio transport (FROZEN — do not change without a real device test):**
- Both `publisher.ts` and `subscriber.ts` use `new RTCPeerConnection({ iceTransportPolicy: 'all' })` with **no app STUN/TURN** (`loadIceServers` is NOT called). Cloudflare is ICE-lite and carries candidates in the SDP; adding app ICE servers caused 1-5s renomination cuts. `iceServers.ts` stays as a documented future opt-in relay path — unused, don't delete.
- Listener **jitter buffer** starts at **3000ms** (`subscriber.ts` `bufferMs = 3000`, `useListenerAudio.ts` `useRef(3000)`), capped `Math.min(bufferMs, 4000)`. Host can broadcast a different buffer live (`room:control`/`buffer`); host slider default `hostPrefs.ts bufferSec = 5`. 2000ms underran → cuts; 3000ms is the proven floor.
- Listener does NOT reactively reconnect on a transient blip ("Sunday leave-alone"). A real connect-phase ERROR shows TAP/RETRY; after a phone lock the resume tap rebuilds the connection (`wasBackgrounded` → `retryKey`).

**Broadcast identity = `startedAt`, NOT `cfSessionId` (fixed 2026-07-26):** a host network drop drives the reconnect FSM to call `publisher.connect()` again, which re-POSTs `publish-offer` and mints a **new `cfSessionId` mid-show**. That is the same broadcast, so `broadcastStartedAt()` in `api/rtc-session.ts` carries the existing `startedAt` forward and only stamps a new one on a go-live from off-air. Anything that must survive a host reconnect keys on `startedAt`: listener re-entry (`RadioApp.tsx`), `useChat.ts`, `useReactions.ts`. Anything genuinely tied to the SFU connection still keys on `cfSessionId`: `useListenerAudio.ts` (a new CF session really is a new track to pull) and the restreamer's `decideAction`. Before this fix, one blip re-stamped `startedAt`, which hid the whole broadcast's chat behind RLS `chat_visible()` and kicked every listener back to the entry gate — it read as "the broadcast stopped and chat was erased". Nothing was ever deleted.
- `publisher.connect()` calls `this.disconnect()` first. Without it every reconnect leaked the old PC (handler still attached) plus another 3s stats interval, and the leaked loops split the byte counters into a false "degraded".
- **The retry budget is ~31s, and an outage that outlives it needs the network's help to recover (fixed 2026-07-31).** `MAX_RETRIES = 6` over exponential backoff is roughly 31s of wall clock, but while the network is down each attempt fails the *instant* it is made, so the budget burns out long before the WiFi comes back. The FSM then parks in `lost`, which is terminal (only `CONNECT` leaves it). Restoring the network used to do nothing: the console sat on "Connection lost. Check your network and press GO LIVE to try again" and the host had to notice. `GoLivePanel` now listens for the browser `online` event and dispatches `CONNECT` when `shouldResumeOnOnline(fsmStatus, hasLiveStream)` (in `connectionFsm.ts`) allows it — `lost` only, and only while the mixer stream still exists, so a fatal setup error (mic blocked, not-admin) never auto-retries. The resume re-publishes into a station row still marked `live`, so `broadcastStartedAt()` preserves `startedAt` and listeners keep their chat. Verified live 2026-07-31 via the manual equivalent.

**Now-playing:** track name folds into the stage banner (`DanceFloor.tsx` → `NowPlaying.tsx`), peeks 15s/min (`nowPlaying.ts peekVisibleAt`), and **marquees** long titles (`.radio-np-marquee` in `radio.css`, overflow-measured). PA speakers sit just under the full-width banner (`PaStack`, `top-[88px]`).
- **Latent feature — DO NOT delete:** host cover-art extraction (`artwork.ts`, `extractArtwork`) + the now-playing display-mode selector (`npMode` in `GoLivePanel.tsx`) are kept for future re-enable; the listener just ignores the broadcast `art`/`mode` fields. Old floating `NowPlayingCard.tsx` recoverable from git (`87d8fcc~1`).

**Chat:** mid-broadcast joiners load the whole broadcast's history — floored at `station.live_session.startedAt` (written server-side on Go-Live in `api/rtc-session.ts`, and preserved across a host reconnect — see broadcast identity above), see `chatReloadFloor` in `chatRules.ts`. Chat body has `dir="auto"` for Hebrew RTL. Messages insert straight into Supabase `chat_messages` and stream back via Realtime `postgres_changes`; body renders as escaped React text (never HTML).

**Chat platform features (`feat/chat-upgrades`, 2026-07-18):**
- **Emoji picker** — desktop Smile-button popover, curated grid in `emojiSet.ts` (`EMOJI`), inserts at the textarea caret. Plain Unicode, no dependency, no schema.
- **Reply** — tap the Reply affordance on a message; composer shows a "Replying to X" chip; the sent message renders a quoted stub. Denormalized columns `reply_to_id`/`reply_to_name`/`reply_to_body` (no join, survives the 100-msg window). Snippet built by `buildReplySnippet` in `chatRules.ts`.
- **Reactions** — `chat_reactions` table (unique per message/uid/emoji, `on delete cascade` from `chat_messages`), gated by `reaction_allowed()` (ban + live, no slow-mode). `useReactions.ts` subscribes to its own `postgres_changes` (INSERT + DELETE); `aggregateReactions` in `chatRules.ts` tallies per message. Quick set `REACTIONS` in `emojiSet.ts`.
- **GIFs — DEFERRED (not shipped).** Google shut down the **Tenor API on 2026-06-30** (new signups closed 2026-01-13), so the Tenor build was removed. The `gif_url` column stays in `chat_messages` as a **latent** field (see `types.ts`, still has a Tenor-host CHECK in `radio-schema.sql`) so a provider can be re-wired without a migration; nothing writes or renders it today. To re-enable, pick a provider (**Klipy** is the near-drop-in ex-Tenor replacement: `GET https://api.klipy.com/api/v1/{KEY}/gifs/search?q=&per_page=&rating=g`, key in the path, safe-content via `rating=g`; Giphy is the alt but needs production approval), then re-add a server proxy under `api/`, a `GifPicker`, a client `isAllowedGifUrl` locked to that provider's image CDN, and update the DB CHECK host to match. Keep the same bandwidth caps (tiny formats, small limit, lazy images, ~300ms debounce) so GIF fetches never compete with the audio stream.
- **Audio untouched:** none of the above touches the FROZEN audio path (`publisher.ts`/`subscriber.ts`/`useListenerAudio.ts`/`iceServers.ts`/jitter buffer). Chat/reactions ride Supabase; audio rides the Cloudflare SFU.

**Chat retention + owner download:** END BROADCAST no longer wipes `chat_messages`. The rows stay in Supabase and are reclaimed by the existing 48h TTL cron (`radio-schema.sql` section 11). Privacy is enforced by RLS: the `chat_read` policy uses `chat_visible(created_at)` so listeners can only read the CURRENT live session's messages (admin reads all; off air, non-admins read nothing) — past broadcasts are never visible to guests, in UI or via raw query. On END BROADCAST the server returns this broadcast's chat (nickname + message only, no `uid`/`device_id`) as a plain-text transcript (`api/chatTranscript.ts`, `buildChatTranscript`); `GoLivePanel.handleEnd` auto-downloads it to the host device (`downloadTextFile`, `subspace-radio-chat-YYYYMMDD-HHMM.txt`). No archive table.

The transcript is built **unconditionally**, so a chat-less broadcast still saves a file saying `Messages: 0`; a missing file used to be indistinguishable from a broken feature (2026-07-26). The chat read's error is logged and written into the header as a `WARNING:` line, so "nobody typed" and "the read failed" never look alike. Belt and braces: **DOWNLOAD CHAT LOG** in the host console (`handleDownloadChatLog`, `data-testid="download-chat-btn"`) reads `chat_messages` straight from the browser through the admin's own session, so the log is recoverable after the fact even if the END BROADCAST request or the server-side read fails. It reuses the same `buildChatTranscript`, imported across the boundary from `api/chatTranscript`, so both files are byte-identical.

**Moderation — IN THE GUEST ROOM, not the console (`feat/radio-moderation`, 2026-07-26):** built after a listener flooded the chat with hate speech on 2026-07-25. The host sits in `/radio` during a broadcast, so the controls live there and are invisible to listeners.
- **Host blends in.** `chat_allowed()` used to require `_is_host = has_role(...)` — an exact match, which silently rejected *every* message the host sent while signed in as admin (`useChat` always sends `is_host: false`). Now it is an implication: `(not _is_host or has_role(...))`. Non-admins still can never claim the HOST badge. **This is a schema change; re-run `supabase/radio-schema.sql`.**
- **Becoming moderator:** `useModeration.ts` gates the UI on the session JWT's `aal === 'aal2'` (listeners are anonymous `aal1`; only the TOTP host reaches `aal2`) — a UI hint only, the server re-authorizes every call. Same browser as the console → controls appear automatically. Phone → the padlock in the chat header opens `HostLoginSheet.tsx`, which wraps `AdminGate` as-is (one host sign-in implementation, not two) and elevates the session in place. The uid changes but `deviceId` does not, so `dedupeByDevice` already collapses the stale presence entry.
- **Controls:** per-message shield → DELETE / KICK / BAN (`Chat.tsx` `moderation` prop); KICK / BAN per listener in `PresenceList.tsx` (for someone who never typed); SLOW (0/3/10/30s) + LOCK CHAT strip in `LiveRoom.tsx`. Ban takes two taps. All props are optional — absent for listeners, so the controls are in nobody else's DOM.
- **The host roster must stay bounded (`max-h-[30vh] overflow-y-auto shrink-0` on the `PresenceList` root).** In host mode the roster switches from wrapped chips to one 44px KICK/BAN row per listener, so it grows with the crowd. Unbounded, it ate the whole sidebar and collapsed `Chat` — which is `flex-1 overflow-y-auto`, so its CSS automatic minimum size is 0 — to zero height. Found live 2026-08-01 at 15 listeners: the host could not see chat on phone or desktop while every listener could, because listeners never get the tall branch. Any new host-only panel in that column needs its own height cap for the same reason.
- **The host roster is uncapped and sorted; the listener chip roster is not.** `slice(0, 20)` + `+N more` predates moderation and is fine for decorative chips, but for the host an unreachable listener is an unmoderatable one, and at 50-100 in the room the abuser is as likely to be #63 as #3. The host branch renders every entry and the 30vh scroll container carries the height. Both branches sort by `deviceId` (the comparator `DanceFloor.tsx` already used for the crowd): presence sync order reshuffles on every join/leave, so an unsorted roster can move a row between the host reading a name and their thumb landing on BAN.
- **The crowd ROAMS a region; there is no grid (`feat/crowd-roam`, 2026-08-02).** It used to be a grid of fixed cells inside the bottom ~25% strip, each avatar drifting only the slack inside its own cell (about 2px at density). That read as a formation, and nobody could stand near the PA stacks because there was no floor under them. Now `crowdRegion()` is the whole usable floor (below the banner/DJ, above the controls gutter, full width), `vizCircle()` is an exclusion circle the crowd walks *around*, and `roamPath()` gives each listener a deterministic looping tour seeded from their uid, rejection-sampled clear of the visualizer. `radio-roam` in `radio.css` walks the waypoints via `--r1x..--r4y`, so 200 roamers still cost no JS per frame. **Every fixed prop on the floor is an obstacle, not just the visualizer:** `obstacleRects()` mirrors the two PA stacks (`top-[88px]`, `left/right-[0.5%]`, width stepping with the breakpoint, svg aspect 200x260, hidden below 400px), and both point tests and segment tests run against the circle AND the rects. **The animation interpolates in a STRAIGHT LINE between waypoints, so clearing an obstacle at each waypoint is not enough** - two waypoints on opposite sides walked the avatar straight through the artwork. `roamPath` requires every leg (including the closing leg home) to clear every obstacle, with a repair pass that collapses an offending waypoint onto its predecessor so a tour can always be made safe. The test samples along each leg rather than only at its ends, and collects breaches instead of asserting per sample - ~500k `expect()` calls times the test out. A tile's position comes from waypoint 0, NOT a grid cell: with a grid anchor the crowd snapped back into formation every time the loop came round. `crowdCapacity` and `crowdTileSize` derive from region area minus the visualizer, so density and label visibility still fall off as the room fills.
- **The crowd is a steering SIMULATION (`crowdMotion.ts` + `useCrowdMotion.ts`), and this is the one place the radio room runs JS per frame.** Three models were tried: a grid of fixed cells (read as a formation), CSS roam paths (walked through each other and through props), and private territories (no crossings, but caged everyone in their own patch). Only a simulation gives free movement AND avoidance, because avoidance requires knowing where the others are. Kept cheap deliberately: a spatial hash so neighbour lookups are O(n) not O(n^2), a 30fps tick, positions written straight to `style.transform` so **React never re-renders on movement**, and the loop stops entirely when the crowd is empty, the tab is hidden, or `prefers-reduced-motion` is set (agents are still placed, just never animated).
- **A join or a leave must NOT re-seed the crowd, and the rng must be warmed (`fix/crowd-spread`, 2026-08-02).** Reported as "even up to 50 listeners, then heavily clustered on one side". Two causes, neither of them density. (1) `useCrowdMotion` keyed its re-seed on `uids.join('|')`, so **one person arriving teleported all 200 back to their starting layout**; above ~50 the churn beats the simulation and the room never gets to spread out. It now carries agents in a `Map<uid, Agent>`: newcomers are seeded, leavers dropped, everyone else keeps their position, and only a geometry change (a resize) reseeds everybody. (2) `seedAgents` and `pickTarget` both read the **first** output of a freshly seeded xorshift32, and that value barely moves between nearby seeds (5381/5382/5383 all give 0.3387) - it becomes `x`, so uids whose hashes land close together all seeded at the same horizontal position. `rng()` now discards `RNG_WARMUP = 4` outputs first. Measured as variance-to-mean over a 4x4 grid against a uniform-random baseline on the same floor: 200 desktop went 18.71 -> 5.15 against an ideal of 6.42. Both fixes are guarded by tests that were confirmed to fail without them. **`?crowdtest=N` mints sequential uids, so it is the worst case for (2) and the best case for (1)** - it never churns; judge churn behaviour with a real second browser. Also note `resolveObstacles` now pushes out by `EPS` rather than landing exactly on the clearance, since a boundary placement is at the mercy of rounding in the same `hypot` that checks it.
- **The simulation's CPU cost is not the thing to worry about.** Measured on the real `stepAgents`: 0.027 ms/tick at 50 avatars, 0.076 at 100, **0.167 at 200** - half a percent of one core at the 30fps tick. `CROWD_HARD_CAP = 200` is a legibility limit, not a performance one, and lowering it buys nothing. The cost that could plausibly touch audio is the ~200 `style.transform` writes and composited layers per tick, which is browser-side, unmeasurable from Node, and paid regardless of how the crowd is distributed. Do not re-litigate the cap without a device measurement showing glitching that tracks crowd size.
- **Separation is soft, obstacles are hard.** Neighbours push apart within `SEPARATION_RADII` and may brush and slightly overlap - that was the explicit ask, "just don't go through each other". Props are different: a proportional push **fails**, because it fades to nothing at the boundary and balances against the wander pulling inward, so avatars settle just inside the clearance. The push is constant while inside, and `resolveObstacles()` then runs after integration as a hard positional constraint, because forces can always be overpowered by a tight pocket of neighbours. An escape direction is only used if there is floor beyond it: the PA stacks run off the side of the region, so "shortest way out" could otherwise be a direction where the region clamp puts the avatar straight back inside the prop.
- **The floor is bounded by three fixed obstacles, and all three must be honoured.** The visualizer (`VIZ_*` constants mirror its JSX wrapper: `top-[52%]`, `64vmin` capped at 460px), the stage block above (`STAGE_BOTTOM_PX`, the banner plus the DJ on the riser, in px because both are fixed-height), and the volume pill below (`CONTROLS_GUTTER_PX`). Honouring only one of them puts avatars inside another: lifting the band to clear the pill once pushed the top row into the artwork on both phone and desktop. **If the visualizer's wrapper moves or resizes, `VIZ_*` must move with it.**
- **The volume control is a row of its own on phones, not an overlay.** As `absolute bottom-4 left-4` it covered the dancers, and once the crowd roams the whole floor there is no spare corner to give. Desktop keeps the floating pill; below `md` it renders as a flex row under the floor in `LiveRoom.tsx`.
- **Crowd motion + the happy glow (`feat/crowd-dance-glow`, 2026-08-02).** The crowd already bobbed (`radio-bob`, per-avatar `animationDelay`/`animationDuration` seeded from `hashUid`); what was added is **lateral wander** and a **cheer** reaction. Wander (`.radio-wander` in `radio.css`, driven by `--wx`/`--wy`) sweeps only the jitter slack `gridSlot` already reserved, at `WANDER_AMPLITUDE = 0.8` of it, so drifting can never close a gap the layout has not proved. It needs its own wrapper div because the slot element owns `translate(-50%,-50%)` and the inner element owns the bob, and one element cannot carry two transforms. **The overlap test is extended to the worst case** (both neighbours swung at each other); loosen the amplitude, never that test. A **cheer** rides the presence payload as `cheerAt` (no table, no migration, no RLS — a mood should die with the session; accepted cost is no history and no survival across a reconnect), is **rate limited to one per device per 3s inside `usePresence`** because `track()` rebroadcasts to every subscriber, and lights the avatar with the previously-dead `radio-dance` (0.9s) plus `.radio-cheer` for `CHEER_MS`. `isCheering()` rejects a future timestamp, since presence carries the sender's clock and a skewed device would otherwise stay lit forever. The trigger is a 44px button in `ChatInput`, **not** the avatar: at crowd scale a tile is near the 16px floor, far under the touch-target minimum. All the new classes join the existing `prefers-reduced-motion` disable list. **The bob is deliberately NOT bounded the same way, and the asymmetry is intentional** (decided 2026-08-02 after measuring): `radio-bob` sweeps a fixed 9px each way at any density, while the tightest vertical gap at capacity is 7.8-16.6px, so packed avatars pass through each other. At that density there are **no name labels** (measured: 0 of 200), and label collision is the reason the no-overlap rule exists at all; overlapping glowing dots read as a crowded room. Wander itself stays strictly bounded, so it shrinks to ~2px on a full phone floor - that is the bound working, not a bug. See the measured table in the spec before changing either.
- **Seeing a packed dance floor without a real crowd: `/radio?crowdtest=200`.** Pads the floor with locally-rendered stand-ins (`readCrowdTestParam` / `padCrowd` in `DanceFloor.tsx`, clamped at 500). Nothing is tracked or sent, so it costs no anonymous sign-ins and no other viewer sees them - unlike `radio-fake-crowd.mjs`, which mints real Supabase users and puts them in the project-wide `room:main`. Use the param for layout/density, the script for anything that must exercise the real presence path. Follows the existing `?debug` flag convention.
- **"You" is a single mote orbiting your avatar (`.radio-orbit`).** A ring read as a bulky square, because the svg's artwork is inset from its box so no band ever hugged the glyph; a floor spotlight was then lost in a packed room. A moving point is findable at any density and costs one element. The cheer separately uses `brightness()`/`saturate()` on top of the halo - a bigger blur alone did not look brighter than the neighbours.
- **Testing host UI with a real crowd:** `node --env-file=.env scripts/radio-fake-crowd.mjs <count>` joins N fake listeners to presence (anon sign-in → `room:main` → `track()`), holds them until Ctrl+C, then untracks. Distinct from `radio-loadtest.mjs`, which measures the sign-in ceiling and never joins presence, so it puts nobody in the roster. **`room:main` is one channel for the whole Supabase project** — not per broadcast, not per deployment — so fakes appear in the production room to any real listener. Run it only on an empty room, and delete the throwaway anon users afterwards. A second arg offsets the `Test NN` names (`... 60 60` adds Test 61-120 beside a running `... 60`) so a crowd can be grown from a second window without re-spending the sign-ins already paid to the per-IP cap. `--chat=200` posts 200 numbered messages up front (round-robin across the fakes, since `chat_allowed()` enforces slow mode per uid) before settling into ambient chatter; the panel keeps the newest 100 (`MAX_MESSAGES` in `useChat.ts`). `--chat` makes the fakes talk: real `chat_messages` rows, so they need the station LIVE and unlocked (off air `chat_allowed()` refuses them with `23514`), they keep the 48h TTL, and **they land in the END BROADCAST transcript** — never use it on a broadcast whose log matters.
- **Server:** one `phase: 'moderate'` branch in `api/rtc-session.ts` (`delete_message`/`kick`/`ban`/`unban`/`set_chat`), gated by the existing `checkAdminAal2`, writing with the service-role client for the same reason END BROADCAST does. Payload validation is pure + tested in `api/moderationRules.ts`; self-kick/self-ban refused. A ban writes a `kicks` row too, so ejection is immediate.
- **A ban cuts audio:** `subscribe-pull` now calls `findBan(uid, deviceId)` and returns `403 banned` before touching Cloudflare, so clearing storage and re-authenticating anonymously still cannot pull the stream. `subscriber.ts` sends `deviceId` (from `getOrCreateIdentity()`) in the pull body — the **only** touch to the frozen audio path: one JSON field, no RTC/ICE/jitter-buffer change.
- **Live delete:** `useChat` subscribes to `DELETE` on `chat_messages` (payload carries only the PK) so a deleted message leaves every screen within a second. `LiveRoom` now honours `isBanned` (previously returned by `usePresence` and ignored), unmounting the room and its audio.
- **Honest limit:** a ban keys on `uid` + `deviceId`; clearing browser storage mints a new identity. IP blocking was deliberately rejected (shared carrier/campus IPs catch innocents). No auto word-filter — if wanted later it goes inside `chat_allowed()`, no UI change.
- **Console MODERATION tab is still a placeholder** — deliberate. The same hook and props drop into it as a follow-up.
- **A kick must UNMOUNT the room, not swap its screen.** `LiveRoom` used to render REMOVED FROM ROOM / SIGNAL BLOCKED from an early return, which left every hook above it running: `usePresence` kept tracking (so the kicked listener never left the host's room list) and `useListenerTransport` kept playing. A kick looked like it did nothing. Removal is now escalated to `ListenerApp` via `onRemoved`, which unmounts `LiveRoom` and renders the screen itself. Tests assert the escalation, not the screen — asserting the screen is what hid this for a month.

**RLS: audit the LIVE database, never the schema file (2026-07-26/27).** PERMISSIVE policies are OR'd, so one policy with a `true` qual/with_check silently cancels every strict policy on that table, and a policy added by hand in the dashboard is invisible to this repo — re-running `radio-schema.sql` adds and replaces, it never removes. Four such policies were found by audit: `chat_insert_own` (with_check `true`, cancelled every ban/slow/lock), `chat_read_all` (qual `true`, exposed every past broadcast's chat), `station_admin_write` (for all, `has_role(admin)` only, cancelled the `is_admin_aal2()` requirement on station_write) and a duplicate `station_public_read`. All four are now dropped explicitly in `radio-schema.sql` so applying the schema RESTORES enforcement. `reactions_read` was separately tightened from `using (true)` to the visibility of its parent message — bodies were protected by `chat_visible()`, but reaction rows (`message_id`/`uid`/`device_id`/`emoji`) from past broadcasts were not. Audit before trusting any restriction:
```sql
select tablename, policyname, cmd, permissive, qual, with_check
from pg_policies
where tablename in ('chat_messages','chat_reactions','bans','kicks','station')
order by tablename, policyname;
```
Anything PERMISSIVE with a bare `true` is a hole. Reading the policy proves it is written; only a denied attempt (ban a test device mid-broadcast, confirm the send fails) proves it is enforced.

**Known constraint (unfixable in-browser), and what solves it:** listener audio (a WebRTC MediaStream) **stops on phone screen-lock / background** — iOS/mobile suspend MediaStream audio; Wake Lock + MediaSession can't keep it alive. The resume tap reconnects on reopen as the in-browser mitigation. The actual fix is **built and in routine use**: the deep-buffer HLS restreamer (`restreamer/`, see below). It only applies while that program is running on a PC; with it off, the constraint above is exactly as stated.

**Deep-buffer restreamer (`restreamer/`) — the host's view of it.** A standalone Node service that pulls the show off the SFU as an anonymous listener, transcodes to HLS, uploads to R2, and writes `station.live_session.streamUrl`. It touches no audio device and no local capture, so **it does not care which device the host DJs from** — `decideAction` (`restreamer/src/station.mjs`) polls the `station` row every 3s and starts/stops itself when the server flips `mode`. GO LIVE *is* its trigger; there is nothing to press. Its one manual step is a double-click of `start-restreamer.bat` on one Windows PC. Operating instructions: `restreamer/HOW-TO-RUN.md`.

**It is machine-portable, and the folder is the whole program minus two installers.** Verified 2026-08-16: zero native dependencies in `node_modules` (no `.node`, no `binding.gyp`), so the 36MB folder copies to another Windows PC as-is with **no `npm install`**. What does NOT travel with it is Node and ffmpeg themselves (`winget install OpenJS.NodeJS.LTS` + `winget install Gyan.FFmpeg`, matching the 24.x / 8.x this runs on), and `FFMPEG_PATH` in `.env` is the single line that must be re-pointed. `npm run selfcheck` resolves ffmpeg from PATH rather than a hardcoded host path, so it is usable before `.env` is edited. **It is necessary but NOT sufficient as the go/no-go:** it deliberately ignores `.env`, while the real service runs `node --env-file=.env`, where a stale `FFMPEG_PATH` beats PATH. So GREEN can sit beside a restreamer that cannot boot, and the only symptom is a DEEP BUFFER badge that never leaves OFF. Booting `node --env-file=.env src/index.mjs` until it logs `restreamer watching station` is the second, separate check. Host walkthrough: "Moving it to another computer" in `HOW-TO-RUN.md`. **Two copies running at once corrupts the stream silently** (both write the same R2 prefix and both write `streamUrl`, with nothing on either screen warning you) and there is still no single-instance guard, so moving it means closing the old window, not leaving it as a spare.

**DEEP BUFFER badge (host console).** `live_session.streamUrl` is now read by the host too, not just listeners: `useDeepBufferStatus.ts` + the pure reducer `src/radio/hls/deepBufferProbe.ts` drive an OFF / STARTING / ON / STALLED badge beside ON AIR in `GoLivePanel.tsx`. It exists because the restreamer's console window is invisible when the host broadcasts from another device — GO LIVE remotely used to mean hoping. **It probes liveness, it does not trust the URL:** a restreamer PC that loses power never clears `streamUrl`, so a URL-only badge would show green over silence. It re-fetches the `.m3u8` every 10s and checks the body changed; frozen 15s reads `STALLED` (same signal `shouldFallback` in `useListenerTransport.ts` uses to drop listeners back to WebRTC). Read-only: no server code, no schema, no new permissions, inert off air and when no `streamUrl` is advertised. Verified live 2026-07-30 (green, then STALLED on killing the restreamer mid-broadcast).

**Listener capacity (the real ceiling):** NOT Cloudflare (bandwidth-only free tier, fine for hundreds) and NOT any code cap (none exists). The wall is **Supabase free-tier auth**: each listener does an anonymous sign-in, capped at **30/hour by default**. **Raised and confirmed 2026-07-30: 300 requests/h, and it is per hour PER IP ADDRESS, not per project** (Supabase Dashboard → Authentication → Rate Limits). Per-IP is the part that matters: separate devices on separate networks each get their own 300, while a whole room on one venue wifi shares a single bucket. Token refreshes sit at 150/5min per IP (1800/h), so they are not a second bottleneck. **Captcha is OFF** (Authentication → Attack Protection, confirmed 2026-07-30): the app still renders `TurnstileWidget` in `EntryGate.tsx` and `AdminGate.tsx` and still passes a token, but Supabase verifies nothing, so it is decorative. Harmless — `EntryGate` treats captcha as best-effort and never blocks entry on it — but anonymous sign-ups are bot-mintable up to the same 300/h per IP. This was the "test user vs real user" capacity question. `api/rtc-session.ts` caches token verification 60s (fewer getUser calls) and returns a `reason` (`rate_limited` vs `invalid_token`) so a rejection is provable in logs; EntryGate shows a calm "Room is busy" message on a rate-limit. Load-test with `scripts/radio-loadtest.mjs <url> <count>`. Full owner guide: `docs/RADIO-CAPACITY.md`. Beyond ~150, use the HLS restream. (Vercel keeps runtime logs only briefly — instrument before the broadcast, not after.)

**Stable tags:** `radio-stable-2026-06-25` (current prod), `guest-audio-stable-v1` / `radio-guest-stable-2026-06-23` (the audio-cut-fix reference). Roll back to a tag if prod regresses.

**Host operation manual:** printable 5-page host guide (Voicemeeter wiring, Go-Live flow, preflight, Spotify routing, deep-buffer restreamer + DJ-from-any-device, leaving the PC while on air). Source of truth is `restreamer/guide/build_guide.py` (reportlab); `python build_guide.py` re-renders `Voicemeeter-Broadcast-Guide.pdf`. Working copy also lives on the desktop. Update the script whenever the broadcast flow changes. See `restreamer/guide/README.md`.

**Windows session rules while on air (page 5 of the guide, tested 2026-07-26 on production):** `Win+L` lock is **safe** (proven: a listener on mobile data kept audio for 7+ minutes with the host PC locked). **Logging out kills the show** - Windows terminates the whole session, so Chrome, Voicemeeter and the restreamer all die and listeners get a connection error; the station row stays LIVE because no END BROADCAST fired, so recovery is DOWNLOAD CHAT LOG, END BROADCAST, then GO LIVE fresh. **Switching Windows users** hands the audio endpoints to the new console session: the connection and restreamer stay up but Voicemeeter capture goes silent, and nothing warns you because Opus still encodes silence above the `bps < 20_000` degraded threshold in `publisher.ts`. Untested with the built-in host player, whose file path (`hostMixer.ts`: `<audio>` → `createMediaElementSource` → `createMediaStreamDestination`) never touches a Windows capture device.

---

## Known Future Tasks (not yet built)

- **Galaxy 604 Spotify album URL** — find the album-level URL (not track URL) and add back to the Galaxy 604 MusicAlbum JSON-LD entry.
- **Debut album JSON-LD** — add structured data once the album is released.
- **Restreamer remote start** — starting it is a physical double-click on one Windows PC. There is no way to start it while away, and no single-instance guard if two copies are ever launched. The documented (not set up) workaround is a Task Scheduler background task, see the appendix in `restreamer/HOW-TO-RUN.md`.
- **R2 lifecycle rule** — nothing ever deletes HLS objects; each broadcast writes a fresh `<cfSessionId>/` prefix and they accumulate forever. A bucket lifecycle rule, not code.

---

## Docs

- `docs/superpowers/specs/` — design specs from brainstorming sessions
- `docs/superpowers/plans/` — implementation plans

Key specs on record:
- `2026-06-04-seo-optimization-design.md` — full SEO sweep spec (implemented)
- `2026-06-04-uxaudit-fixes-design.md` — 13-finding UX audit (implemented)
- `2026-06-13-quick-access-links-design.md` — clickable Music Archive release rows (implemented)
- `2026-07-18-guest-chat-upgrades-design.md` — radio chat emoji picker, reply, reactions, GIFs (implemented on `feat/chat-upgrades`)
- `2026-08-02-crowd-dance-glow-design.md` — dance-floor wander + the happy glow reaction (implemented on `feat/crowd-dance-glow`)
- `2026-08-02-crowd-roam-design.md` — replacing the crowd grid with a roaming region (implemented on `feat/crowd-roam`)

Owner manuals / recaps:
- `docs/RADIO-CAPACITY.md` — how many listeners the radio holds + how to raise it (Supabase anon sign-in cap). The answer to the "how many can I host" question.
- `docs/superpowers/recaps/2026-07-19-radio-capacity-recap.md` — capacity diagnosis + fix (shipped to prod, PR #7). Root cause = Supabase free-tier anon sign-in rate limit, NOT Cloudflare, NOT a code cap.
