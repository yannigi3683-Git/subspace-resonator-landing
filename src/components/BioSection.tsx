import bioWatermark from "@/assets/bio-watermark.jpg";

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
          <p className="text-sm leading-relaxed text-foreground mb-4">
            Emerging from the late '90s Goa Trance movement, I operated when the underground was a guarded frequency — no stage names, no digital footprints. If you knew the coordinates, you were part of the resonance.
          </p>
          <p className="text-sm leading-relaxed text-foreground mb-6">
            Israel, 1998. Illegal outdoor parties in the Judean hills, the Galilee, and the Negev desert — before permits, before streams, before algorithms. A generation that staged the "Give Trance a Chance" protest at Rabin Square just to defend the right to the frequency. That's the scene I came from. That's the signal I carry.
          </p>
          <p className="text-xs tracking-[0.2em] text-primary mb-3 uppercase">The Reactivation</p>
          <p className="text-sm leading-relaxed text-foreground mb-6">
            Back after 2 decades off the radar — driving basslines, cosmic synths, and hypnotic rhythms engineered for pure dancefloor ignition. Transmissions that blend Goa-inspired grooves with multidimensional textures and alien frequencies. Sharp production, zero compromise on authenticity.
          </p>
          <p className="text-xs tracking-[0.2em] text-primary mb-3 uppercase">The Mission</p>
          <p className="text-sm leading-relaxed text-foreground">
            Deliver mind-bending frequencies and direct access to new sonic dimensions. Releases on Goa Records, Timewarp, Geomagnetic, and Spiral Trax.
          </p>
        </div>
      </div>
    </section>
  );
};

export default BioSection;
