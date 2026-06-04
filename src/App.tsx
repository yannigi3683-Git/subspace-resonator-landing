import { HelmetProvider, Helmet } from 'react-helmet-async';
import SiteHeader from './components/SiteHeader';
import HeroSection from './components/HeroSection';
import MusicPlayer from './components/MusicPlayer/MusicPlayer';
import LabelPedigree from './components/LabelPedigree';
import BioSection from './components/BioSection';
import BookingSection from './components/BookingSection';
import GallerySection from './components/GallerySection';
import SocialMatrix from './components/SocialMatrix';
import liveAlpha from './assets/live-alpha.jpg';
import AccessibilityMenu from './components/AccessibilityMenu';

export default function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <title>Subspace Resonator | Goa &amp; Psychedelic Trance</title>
        <meta name="description" content="Subspace Resonator — Goa &amp; Psychedelic Trance producer. Stream releases on SoundCloud, Spotify &amp; Bandcamp. Direct booking available." />
        <link rel="canonical" href="https://subspaceresonator.com/" />
        <meta name="keywords" content="Subspace Resonator, Goa Trance, Psychedelic Trance, Goa Records, Timewarp, Geomagnetic, Spiral Trax, psytrance DJ, psytrance live act" />
        <meta property="og:title" content="Subspace Resonator | Goa &amp; Psychedelic Trance" />
        <meta property="og:description" content="Goa &amp; Psychedelic Trance producer. Stream releases, view the visual archive, book direct." />
        <meta property="og:url" content="https://subspaceresonator.com/" />
        <meta property="og:type" content="music.musician" />
        <meta property="og:image" content="https://subspaceresonator.com/og-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Subspace Resonator | Goa &amp; Psychedelic Trance" />
        <meta name="twitter:description" content="Goa &amp; Psychedelic Trance producer. Stream releases, book direct." />
        <meta name="twitter:image" content="https://subspaceresonator.com/og-image.jpg" />
        <meta name="theme-color" content="#030303" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="Subspace Resonator" />
        <meta property="og:image:alt" content="Subspace Resonator — Goa &amp; Psychedelic Trance" />
        <meta property="og:image:secure_url" content="https://subspaceresonator.com/og-image.jpg" />
        <meta name="twitter:image:alt" content="Subspace Resonator — Goa &amp; Psychedelic Trance" />
        <meta name="robots" content="index, follow" />
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

      <div className="min-h-screen pb-40 md:pb-20 relative">
        {/* Full-page background: single composited layer (image + overlay merged via ::before avoids double GPU layer) */}
        <div
          className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${liveAlpha})`,
            willChange: "transform",
          }}
        >
          <div className="absolute inset-0 bg-background/85" />
        </div>

        <a href="#main-content" className="skip-link">Skip to main content</a>
        <AccessibilityMenu />
        <div className="relative z-10">
          <SiteHeader />
          <main id="main-content">
            <HeroSection />
            <MusicPlayer />
            <LabelPedigree />
            <BioSection />
            <BookingSection />
            <GallerySection />
            <SocialMatrix />
          </main>

          <footer className="border-t border-border py-8">
            <div className="container text-center">
              <p className="text-[12px] text-muted-foreground tracking-[0.3em]">
                © 2026 SUBSPACE RESONATOR — ALL FREQUENCIES RESERVED
              </p>
              <p className="text-[11px] text-muted-foreground mt-2">
                BOOKING:{' '}
                <a href="mailto:subspaceresonator@gmail.com" className="hover:text-primary transition-colors">
                  subspaceresonator@gmail.com
                </a>{' '}
                ·{' '}
                <a href="tel:+972507974184" className="hover:text-primary transition-colors">
                  +972-50-7974184
                </a>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </HelmetProvider>
  );
}
