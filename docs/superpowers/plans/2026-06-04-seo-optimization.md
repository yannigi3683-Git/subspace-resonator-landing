# SEO Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill all remaining SEO gaps — static HTML fallback, 6 missing Helmet meta tags, MusicGroup schema enrichment, and a second JSON-LD block covering 6 released tracks/EPs/compilations.

**Architecture:** Two files only. `index.html` gets a title upgrade, static description, and apple-touch-icon for non-JS crawlers. `src/App.tsx` gets 6 new Helmet meta tags, an enriched MusicGroup JSON-LD object (adds `@id`, `logo`, `member`, 4 new `sameAs` URLs, updated `description`), and a second `<script type="application/ld+json">` block containing an `@graph` array of 6 release objects. The `@id` on MusicGroup is the entity IRI that links all `byArtist` fields in the releases block — this is the critical linked-data pattern that lets Google connect the two JSON-LD blocks.

**Tech Stack:** React 18, TypeScript, Vite, react-helmet-async

---

## File Map

| File | Change |
|------|--------|
| `index.html` | Replace bare title, add static description + apple-touch-icon |
| `src/App.tsx` | Add 6 Helmet meta tags; rewrite MusicGroup JSON-LD object; add releases JSON-LD block |

No new files. No new imports.

---

## Task 1: index.html — Static Fallback for Non-JS Crawlers

**Files:**
- Modify: `index.html:7`

**Why this exists:** Twitterbot, LinkedIn unfurl, and Slack previews execute no JavaScript. They read only the raw HTML. The current `index.html` has only `<title>Subspace Resonator</title>` — no description, no apple-touch-icon. Social embeds will show a blank title and no description.

- [ ] **Step 1: Open `index.html`**

Current state of `<head>` (lines 1-8):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Subspace Resonator</title>
  </head>
```

- [ ] **Step 2: Replace the `<head>` block**

Replace lines 3-8 with:

```html
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/og-image.jpg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Subspace Resonator | Goa &amp; Psychedelic Trance</title>
    <meta name="description" content="Subspace Resonator — Goa &amp; Psychedelic Trance producer. Stream releases on SoundCloud, Spotify &amp; Bandcamp. Direct booking available." />
  </head>
```

Note: `og-image.jpg` (1200x630) is already in `public/`. iOS scales it to 180x180 and center-crops. This is acceptable. A dedicated square icon is a future follow-up task, not a blocker.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: no errors (this is an HTML file, TS won't flag it, but running ensures no regressions from the session).

- [ ] **Step 4: Start dev server and inspect the HTML**

Run: `npm run dev`

Open browser → View Page Source (Ctrl+U). Confirm:
- `<title>Subspace Resonator | Goa &amp; Psychedelic Trance</title>` present in raw HTML
- `<meta name="description" ...>` present in raw HTML
- `<link rel="apple-touch-icon" href="/og-image.jpg" />` present

Stop dev server when confirmed.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "seo: static fallback title, description, apple-touch-icon in index.html"
```

---

## Task 2: App.tsx — 6 Missing Helmet Meta Tags

**Files:**
- Modify: `src/App.tsx:32`

**Why these tags:** `og:locale` and `og:site_name` are required by Facebook/LinkedIn for correct content classification. `og:image:alt` and `twitter:image:alt` are accessibility fields. `og:image:secure_url` ensures older Facebook crawlers don't drop the image on HTTPS pages. `robots` removes crawler ambiguity.

- [ ] **Step 1: Open `src/App.tsx`**

Locate line 32 — the last existing Helmet tag before the JSON-LD block:

```tsx
        <meta name="theme-color" content="#030303" />
```

- [ ] **Step 2: Add the 6 new tags immediately after `theme-color`**

Replace:

```tsx
        <meta name="theme-color" content="#030303" />
<script type="application/ld+json">
```

With:

```tsx
        <meta name="theme-color" content="#030303" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="Subspace Resonator" />
        <meta property="og:image:alt" content="Subspace Resonator — Goa &amp; Psychedelic Trance" />
        <meta property="og:image:secure_url" content="https://subspaceresonator.com/og-image.jpg" />
        <meta name="twitter:image:alt" content="Subspace Resonator — Goa &amp; Psychedelic Trance" />
        <meta name="robots" content="index, follow" />
<script type="application/ld+json">
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: exits with code 0, no errors.

- [ ] **Step 4: Start dev server and verify meta tags in browser**

Run: `npm run dev`

Open DevTools → Elements → `<head>`. Confirm all 6 new tags are present:
- `og:locale` → `en_US`
- `og:site_name` → `Subspace Resonator`
- `og:image:alt` → present
- `og:image:secure_url` → `https://subspaceresonator.com/og-image.jpg`
- `twitter:image:alt` → present
- `robots` → `index, follow`

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "seo: add og:locale, og:site_name, og:image:alt, og:image:secure_url, twitter:image:alt, robots to Helmet"
```

---

## Task 3: App.tsx — Enrich MusicGroup JSON-LD

**Files:**
- Modify: `src/App.tsx:33-55`

**Why these additions:**
- `@id` — stable IRI identifier for the MusicGroup entity. Without it, Google cannot link the `byArtist` references in the releases block back to this artist. **This is the most critical field.**
- `logo` — feeds the Google Knowledge Panel logo slot
- `member` — anchors Yanni as the person behind the project
- 4 new `sameAs` URLs — Facebook, TikTok, Beatport, Linktree were in SocialMatrix but missing from schema
- Updated `description` — seeds the upcoming debut album without a false release claim

- [ ] **Step 1: Locate the MusicGroup JSON-LD block in `src/App.tsx`**

Current block is lines 33-55:

```tsx
<script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'MusicGroup',
          'name': 'Subspace Resonator',
          'genre': ['Goa Trance', 'Psychedelic Trance'],
          'foundingDate': '1998',
          'url': 'https://subspaceresonator.com/',
          'image': 'https://subspaceresonator.com/og-image.jpg',
          'description': 'Goa & Psychedelic Trance producer active since 1998. Releases on Geomagnetic, Goa Records, Timewarp and Spiral Trax.',
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
```

- [ ] **Step 2: Replace the entire MusicGroup JSON-LD block**

Replace the block above with:

```tsx
<script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'MusicGroup',
          '@id': 'https://subspaceresonator.com/#artist',
          'name': 'Subspace Resonator',
          'genre': ['Goa Trance', 'Psychedelic Trance'],
          'foundingDate': '1998',
          'url': 'https://subspaceresonator.com/',
          'image': 'https://subspaceresonator.com/og-image.jpg',
          'logo': 'https://subspaceresonator.com/og-image.jpg',
          'description': 'Goa & Psychedelic Trance producer active since 1998. Releases on Goa Records, Timewarp Records, and Geomagnetic. Debut album in production.',
          'member': {
            '@type': 'Person',
            'name': 'Yanni',
            'url': 'https://subspaceresonator.com/',
          },
          'sameAs': [
            'https://soundcloud.com/subspaceresonance',
            'https://open.spotify.com/artist/0UQWUdUuQ3NhMCACj4UXlk',
            'https://yannig.bandcamp.com/',
            'https://www.youtube.com/@SubspaceResonator',
            'https://www.instagram.com/subspace_resonator',
            'https://www.discogs.com/artist/15101171-Subspace-Resonator',
            'https://www.facebook.com/profile.php?id=61559198105695',
            'https://www.tiktok.com/@subspace.resonato',
            'https://www.beatport.com/artist/subspace-resonator/1354950',
            'https://linktr.ee/yanni_subspace_resonator',
          ],
          'contactPoint': {
            '@type': 'ContactPoint',
            'email': 'subspaceresonator@gmail.com',
            'contactType': 'Booking',
          },
        })}</script>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: exits with code 0, no errors.

- [ ] **Step 4: Start dev server and inspect the JSON-LD in DevTools**

Run: `npm run dev`

Open DevTools → Elements → find `<script type="application/ld+json">` (first one). Copy its content and paste into the browser console as `JSON.parse(...)` to confirm it parses without error. Verify:
- `@id` is `https://subspaceresonator.com/#artist`
- `sameAs` array has 10 entries
- `member.name` is `Yanni`
- `description` mentions "Debut album in production"

Stop dev server.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "seo: enrich MusicGroup JSON-LD — @id, logo, member, 4 new sameAs, updated description"
```

---

## Task 4: App.tsx — Releases JSON-LD Block

**Files:**
- Modify: `src/App.tsx:56` (insert before `</Helmet>`)

**Why a second block:** Keeping MusicGroup and releases separate maintains schema clarity — the MusicGroup entity describes the artist; the `@graph` block describes the discography. The `byArtist: { '@id': '...' }` reference in each release object is what connects them to the artist entity defined in Task 3.

Note on album types: schema.org has no `EPAlbum` value. `StudioAlbum` is the correct closest value for an independently produced EP. The three compilation entries use `CompilationAlbum`.

- [ ] **Step 1: Locate the closing `</Helmet>` tag in `src/App.tsx`**

It is at line 56, directly after the MusicGroup `</script>` closing tag.

- [ ] **Step 2: Insert the releases JSON-LD block before `</Helmet>`**

Replace:

```tsx
        })}</script>
      </Helmet>
```

With:

```tsx
        })}</script>
<script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'MusicAlbum',
              'albumProductionType': 'StudioAlbum',
              'name': 'The Subspace Theory',
              'numTracks': 4,
              'datePublished': '2025-12-26',
              'byArtist': { '@id': 'https://subspaceresonator.com/#artist' },
              'url': 'https://yannig.bandcamp.com/album/the-subspace-theory',
            },
            {
              '@type': 'MusicAlbum',
              'albumProductionType': 'SingleAlbum',
              'name': 'Galaxy 604',
              'datePublished': '2025',
              'recordLabel': { '@type': 'Organization', 'name': 'Goa Records' },
              'byArtist': { '@id': 'https://subspaceresonator.com/#artist' },
              'url': 'https://open.spotify.com/track/0ahaMCHJhaLhwBF6oit9Uo',
            },
            {
              '@type': 'MusicAlbum',
              'albumProductionType': 'SingleAlbum',
              'name': 'Nightmare In Heaven',
              'datePublished': '2025-10-31',
              'recordLabel': { '@type': 'Organization', 'name': 'Timewarp Records' },
              'byArtist': { '@id': 'https://subspaceresonator.com/#artist' },
              'url': 'https://beatspace-timewarp.bandcamp.com/album/nightmare-in-heaven',
            },
            {
              '@type': 'MusicAlbum',
              'albumProductionType': 'CompilationAlbum',
              'name': 'The Call Of Goa, Vol. 5',
              'datePublished': '2026',
              'recordLabel': { '@type': 'Organization', 'name': 'Timewarp Records' },
              'track': {
                '@type': 'MusicRecording',
                'name': 'Subspace Disturbance',
                'byArtist': { '@id': 'https://subspaceresonator.com/#artist' },
              },
            },
            {
              '@type': 'MusicAlbum',
              'albumProductionType': 'CompilationAlbum',
              'name': 'Psychedelic Goa Trance 2026 100 Aliens',
              'datePublished': '2026-01-09',
              'recordLabel': { '@type': 'Organization', 'name': 'Fresh Frequencies' },
              'track': {
                '@type': 'MusicRecording',
                'name': 'Galaxy 604',
                'byArtist': { '@id': 'https://subspaceresonator.com/#artist' },
              },
            },
            {
              '@type': 'MusicAlbum',
              'albumProductionType': 'CompilationAlbum',
              'name': 'Psy Trance 2026 Space DJ',
              'datePublished': '2026',
              'recordLabel': { '@type': 'Organization', 'name': 'Fresh Frequencies' },
              'track': {
                '@type': 'MusicRecording',
                'name': 'Galaxy 604',
                'byArtist': { '@id': 'https://subspaceresonator.com/#artist' },
              },
            },
          ],
        })}</script>
      </Helmet>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: exits with code 0, no errors.

- [ ] **Step 4: Start dev server and inspect the second JSON-LD block**

Run: `npm run dev`

Open DevTools → Elements → find the second `<script type="application/ld+json">`. Copy its content and verify in browser console:
- `JSON.parse(...)` produces no errors
- `@graph` array has exactly 6 items
- Every item has `byArtist` set to `{ '@id': 'https://subspaceresonator.com/#artist' }`
- The three compilations each have a `track` object with a `MusicRecording` type

Stop dev server.

- [ ] **Step 5: Build the project to confirm no production bundle errors**

Run: `npm run build`

Expected: exits with code 0. Vite build completes without TypeScript or bundling errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx
git commit -m "seo: add releases JSON-LD @graph block — EP, 2 singles, 3 compilation appearances"
```

---

## Post-Implementation Checklist

After all 4 tasks are committed and the site is deployed:

- [ ] Update `public/sitemap.xml` `lastmod` to the deploy date
- [ ] Submit updated sitemap to Google Search Console
- [ ] Run the Google Rich Results Test on the live URL to confirm no structured data errors
- [ ] Future task (not this sprint): create a dedicated 180x180 `apple-touch-icon.png` from the logo asset
