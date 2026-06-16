import bioWatermark from "@/assets/bio-watermark.webp";
import { useBio } from "@/lib/siteContent";

const BioSection = () => {
  const bio = useBio();
  return (
    <section id="bio" aria-label="Bio" className="pt-4 pb-4 md:pt-8 md:pb-8 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-no-repeat bg-center bg-contain opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: `url(${bioWatermark})` }}
        aria-hidden="true"
      />

      <div className="container relative z-10">
        <h2 className="text-sm tracking-[0.3em] text-primary mb-8 uppercase">
          // BIO
        </h2>

        <div className="section-border p-6 md:p-10 max-w-3xl">
          <p className="text-xs tracking-[0.2em] text-primary mb-3 uppercase">The Signal</p>
          <p className="text-sm leading-relaxed text-foreground mb-6">{bio.signal}</p>
          <p className="text-xs tracking-[0.2em] text-primary mb-3 uppercase">The Reactivation</p>
          <p className="text-sm leading-relaxed text-foreground mb-6">{bio.reactivation}</p>
          <p className="text-xs tracking-[0.2em] text-primary mb-3 uppercase">The Mission</p>
          <p className="text-sm leading-relaxed text-foreground">{bio.mission}</p>
        </div>
      </div>
    </section>
  );
};

export default BioSection;
