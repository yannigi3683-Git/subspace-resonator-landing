# SEO Optimization — Full Sweep
**Date:** 2026-06-04
**Priority:** Maximum search visibility and social sharing quality
**Scope:** Meta tags, structured data, static HTML fallback
**Files:** `index.html`, `src/App.tsx` only

---

## Context

The site already has a solid SEO foundation: Helmet title/description/canonical, Open Graph tags, Twitter Card, a JSON-LD MusicGroup schema, robots.txt, sitemap.xml, and an og-image.jpg in public. This sprint fills the remaining gaps identified in a full audit.

Approach B was chosen: full metadata sweep + MusicAlbum structured data for released music. L1 (WebP) remains a separate build-tooling task.

---

## Confirmed Discography (source: Bandcamp, Spotify, Beatport, public label pages)

### Solo releases
| Title | Type | Label | Year |
|-------|------|-------|------|
| The Subspace Theory | EP (4 tracks) | Independent | Dec 2025 |
| Galaxy 604 | Single | Goa Records | 2025 |
| Nightmare In Heaven | Single | Timewarp Records | Oct 2025 |

### Compilation appearances
| Compilation | Label | Year | Track contribution |
|-------------|-------|------|--------------------|
| The Call Of Goa, Vol. 5 | Timewarp Records | 2026 | Subspace Disturbance |
| Psychedelic Goa Trance 2026 100 Aliens | Fresh Frequencies / Geomagnetic | Jan 2026 | Galaxy 604 |
| Psy Trance 2026 Space DJ | Fresh Frequencies / Geomagnetic | 2025/2026 | Galaxy 604 |

Note: Defying Gravity, Quantum Mechanics, and Interstellar Future are unreleased tracks slated for the upcoming debut album. They are intentionally excluded from all structured data.

---

## Section 1 — index.html Static Fallback

**File:** `index.html`

**Problem:** The file only has `<title>Subspace Resonator</title>` with no description. Social scrapers (Twitterbot, LinkedIn, Slack unfurl) and non-JS crawlers miss the Helmet-injected tags entirely.

**Fix:** Replace the bare title and add a static description and apple-touch-icon:

```html
<title>Subspace Resonator | Goa &amp; Psychedelic Trance</title>
<meta name="description" content="Subspace Resonator — Goa &amp; Psychedelic Trance producer. Stream releases on SoundCloud, Spotify &amp; Bandcamp. Direct booking available." />
<link rel="apple-touch-icon" href="/og-image.jpg" />
```

The `og-image.jpg` (1200x630) already exists in `public/`. It is serviceable as the Apple touch icon — iOS scales it to 180x180 and center-crops the landscape image. If the logo is centered in the og-image, the result is acceptable.

**Ideal future state:** Create a dedicated `apple-touch-icon.png` at 180x180 (square) from the logo asset. This is a follow-up task, not a blocker.

---

## Section 2 — Helmet Meta Tag Gaps

**File:** `src/App.tsx`

Six tags missing from the existing `<Helmet>` block. Add them directly after the existing `<meta name="theme-color">` tag:

```html
<meta property="og:locale" content="en_US" />
<meta property="og:site_name" content="Subspace Resonator" />
<meta property="og:image:alt" content="Subspace Resonator — Goa &amp; Psychedelic Trance" />
<meta property="og:image:secure_url" content="https://subspaceresonator.com/og-image.jpg" />
<meta name="twitter:image:alt" content="Subspace Resonator — Goa &amp; Psychedelic Trance" />
<meta name="robots" content="index, follow" />
```

- `og:locale` — required by Facebook and LinkedIn for correct content classification
- `og:site_name` — shown in the link preview header on most platforms
- `og:image:alt` — OG accessibility field; displayed by some platforms and required for WCAG-compliant link previews
- `og:image:secure_url` — Facebook's crawlers prefer the explicit HTTPS variant; without it some old crawlers may reject the image even on HTTPS pages
- `twitter:image:alt` — accessibility text for the Twitter card image
- `robots` — explicit is cleaner; removes ambiguity for any non-standard crawler

No `twitter:creator` — no Twitter/X account exists for this artist.

---

## Section 3 — JSON-LD Enrichment

**File:** `src/App.tsx`

### 3a — Complete `sameAs` in MusicGroup

Four platforms present in SocialMatrix but absent from the existing `sameAs` array. Add:

```js
'https://www.facebook.com/profile.php?id=61559198105695',
'https://www.tiktok.com/@subspace.resonato',
'https://www.beatport.com/artist/subspace-resonator/1354950',
'https://linktr.ee/yanni_subspace_resonator',
```

### 3b — Add `@id`, `logo`, and `member` to MusicGroup

```js
'@id': 'https://subspaceresonator.com/#artist',
'logo': 'https://subspaceresonator.com/og-image.jpg',
'member': {
  '@type': 'Person',
  'name': 'Yanni',
  'url': 'https://subspaceresonator.com/',
},
```

The `@id` is critical. It gives the MusicGroup entity a stable IRI identifier. Without it, Google cannot reliably link the `byArtist` references in the releases block back to this entity — the two JSON-LD blocks are effectively disconnected in the knowledge graph.

### 3c — Update MusicGroup `description`

Replace current description with:

```
'Goa & Psychedelic Trance producer active since 1998. Releases on Goa Records, Timewarp Records, and Geomagnetic. Debut album in production.'
```

This seeds Google's entity knowledge with the upcoming album without making a false release claim.

### 3d — Second JSON-LD block: released music

Add a separate `<script type="application/ld+json">` block (keep it separate from MusicGroup to maintain schema clarity) containing an array of six release objects:

All `byArtist` fields use `{ "@id": "https://subspaceresonator.com/#artist" }` — a direct reference to the MusicGroup entity defined in the first JSON-LD block. This is the correct linked-data pattern and is what enables Google to resolve the connection.

**EP:**
```json
{
  "@type": "MusicAlbum",
  "name": "The Subspace Theory",
  "albumProductionType": "StudioAlbum",
  "numTracks": 4,
  "datePublished": "2025-12-26",
  "byArtist": { "@id": "https://subspaceresonator.com/#artist" },
  "url": "https://yannig.bandcamp.com/album/the-subspace-theory"
}
```

Note: schema.org has no `EPAlbum` type. `StudioAlbum` is the correct closest value for an independently produced EP.

**Singles (Galaxy 604, Nightmare In Heaven):**
```json
{
  "@type": "MusicAlbum",
  "albumProductionType": "SingleAlbum",
  "name": "Galaxy 604",
  "datePublished": "2025",
  "recordLabel": { "@type": "Organization", "name": "Goa Records" },
  "byArtist": { "@id": "https://subspaceresonator.com/#artist" },
  "url": "https://open.spotify.com/track/0ahaMCHJhaLhwBF6oit9Uo"
}
```
```json
{
  "@type": "MusicAlbum",
  "albumProductionType": "SingleAlbum",
  "name": "Nightmare In Heaven",
  "datePublished": "2025-10-31",
  "recordLabel": { "@type": "Organization", "name": "Timewarp Records" },
  "byArtist": { "@id": "https://subspaceresonator.com/#artist" },
  "url": "https://beatspace-timewarp.bandcamp.com/album/nightmare-in-heaven"
}
```

**Compilation appearances (3 entries):**
```json
{
  "@type": "MusicAlbum",
  "albumProductionType": "CompilationAlbum",
  "name": "The Call Of Goa, Vol. 5",
  "datePublished": "2026",
  "recordLabel": { "@type": "Organization", "name": "Timewarp Records" },
  "track": {
    "@type": "MusicRecording",
    "name": "Subspace Disturbance",
    "byArtist": { "@id": "https://subspaceresonator.com/#artist" }
  }
}
```
```json
{
  "@type": "MusicAlbum",
  "albumProductionType": "CompilationAlbum",
  "name": "Psychedelic Goa Trance 2026 100 Aliens",
  "datePublished": "2026-01-09",
  "recordLabel": { "@type": "Organization", "name": "Fresh Frequencies" },
  "track": {
    "@type": "MusicRecording",
    "name": "Galaxy 604",
    "byArtist": { "@id": "https://subspaceresonator.com/#artist" }
  }
}
```
```json
{
  "@type": "MusicAlbum",
  "albumProductionType": "CompilationAlbum",
  "name": "Psy Trance 2026 Space DJ",
  "datePublished": "2026",
  "recordLabel": { "@type": "Organization", "name": "Fresh Frequencies" },
  "track": {
    "@type": "MusicRecording",
    "name": "Galaxy 604",
    "byArtist": { "@id": "https://subspaceresonator.com/#artist" }
  }
}
```

All six objects are wrapped in a single `@graph` array inside one `<script>` tag:

```jsx
<script type="application/ld+json">{JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [
    /* EP object */,
    /* Galaxy 604 single */,
    /* Nightmare In Heaven single */,
    /* The Call Of Goa Vol 5 compilation */,
    /* Psychedelic Goa Trance 2026 100 Aliens compilation */,
    /* Psy Trance 2026 Space DJ compilation */,
  ]
})}</script>
```

---

## File Summary

| File | Changes |
|------|---------|
| `index.html` | Title update, static description, apple-touch-icon |
| `src/App.tsx` | 4 new Helmet meta tags, MusicGroup sameAs + logo + member + description update, new releases JSON-LD block |

---

## Out of Scope

- L1 WebP image conversion — separate build-tooling sprint
- Gallery image alt text audit — separate task (21 entries in siteContent.ts, most already have good alt text)
- Preconnect hints for SoundCloud CDN — marginal value since the iframe is lazy-loaded; deferred
- BreadcrumbList / WebSite schema — overkill for a single-page artist site

---

## Safety Notes

- No personal contact info added or changed
- No canonical URL changes
- No link additions or removals in the UI
- Structured data uses only publicly confirmed release information
- Unreleased tracks intentionally excluded
- After implementation, update `public/sitemap.xml` `lastmod` to the deploy date

## Follow-up Tasks (not in this sprint)

- Create a dedicated 180x180 `apple-touch-icon.png` from the logo asset
- L1 WebP image conversion (separate build-tooling sprint)
- Add structured data for debut album once it is released
