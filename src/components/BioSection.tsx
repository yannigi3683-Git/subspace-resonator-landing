import bioWatermark from "@/assets/bio-watermark.webp";

const BioSection = () => {
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
          <p className="text-sm leading-relaxed text-foreground mb-6">
            Emerging from the late-'90s Goa Trance movement, I operated when the underground was still a guarded frequency. No stage names, no digital footprints. If you knew the coordinates, you were part of the resonance. That's the signal I carry.
          </p>
          <p className="text-xs tracking-[0.2em] text-primary mb-3 uppercase">The Reactivation</p>
          <p className="text-sm leading-relaxed text-foreground mb-6">
            Back after two decades off the radar. Bringing Goa-inspired grooves, multidimensional textures, and alien frequencies. This is sharp production, engineered for the underground, with a lot of soul, not for the algorithm.
          </p>
          <p className="text-xs tracking-[0.2em] text-primary mb-3 uppercase">The Mission</p>
          <p className="text-sm leading-relaxed text-foreground">
            To deliver mind-bending frequencies and grant direct access to new sonic dimensions. Catch upcoming releases to be a part of the resonance. The Subspace Resonator is back transmitting sonic adventures through space and time. Join me on a voyage to the unfamiliar parts of the universe. Unleash your mind.
          </p>
        </div>
      </div>
    </section>
  );
};

export default BioSection;
