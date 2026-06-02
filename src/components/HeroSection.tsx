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
