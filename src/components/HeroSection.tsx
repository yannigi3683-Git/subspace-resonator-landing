import bioWatermark from '@/assets/bio-watermark.webp';
import HeroVisualizer from './HeroVisualizer';

const HeroSection = () => {
  const handleScroll = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.querySelector("#music")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section id="hero" className="flex items-center justify-center pt-14">
      <div className="container flex flex-col items-center py-2 md:py-8 lg:py-12">
        <div className="relative w-72 h-72 md:w-[420px] md:h-[420px]">
          <HeroVisualizer bpm={140} className="absolute inset-0 w-full h-full" />
          <img
            src={bioWatermark}
            alt="Subspace Resonator logo"
            className="relative w-full h-full object-contain logo-glitch-idle"
            loading="eager"
          />
        </div>
        <h1 className="sr-only">Subspace Resonator — Goa &amp; Psychedelic Trance</h1>
        <p className="mt-8 text-sm tracking-[0.3em] text-muted-foreground uppercase text-center">
          Goa Trance · Psychedelic Trance
        </p>
        <p className="mt-2 text-sm tracking-[0.25em] text-muted-foreground uppercase text-center">
          Est. 1998 · Reborn 2024
        </p>
        <a
          href="#music"
          onClick={handleScroll}
          className="mt-6 text-xs tracking-[0.35em] text-primary uppercase border border-primary/40 px-6 py-2 hover:border-primary hover:bg-primary/5 transition-colors"
          aria-label="Scroll to music player"
        >
          LISTEN ↓
        </a>
      </div>
    </section>
  );
};

export default HeroSection;
