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
