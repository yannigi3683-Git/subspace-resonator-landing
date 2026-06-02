import { motion } from 'framer-motion';
import bioWatermark from '../assets/bio-watermark.jpg';

const sections = [
  {
    label: '// THE SIGNAL',
    text: "Emerging from the late '90s Goa Trance movement, Subspace Resonator operated when the underground was a guarded frequency — no stage names, no digital footprints. Active since 1998, with releases on Geomagnetic, Goa Records, Spiral Trax, and Timewarp.",
  },
  {
    label: '// THE REACTIVATION',
    text: 'After years of data-gathering, Subspace Resonator returns — fusing primal energy with cutting-edge synthesis and total authenticity. Available as a full live set or DJ set, 60 to 180 minutes. Based in Tel Aviv, touring internationally.',
  },
  {
    label: '// THE MISSION',
    text: 'Deliver mind-bending frequencies and direct signal access to new sonic dimensions.',
  },
];

export default function BioSection() {
  return (
    <section id="bio" aria-label="Bio" className="relative py-20 border-t border-border overflow-hidden">
      <img
        src={bioWatermark}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-contain opacity-[0.06] pointer-events-none select-none"
      />
      <div className="container relative">
        <p className="text-xs font-mono tracking-widest text-primary mb-12">// TRANSMISSION</p>
        <div className="max-w-2xl space-y-10">
          {sections.map((s) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-xs font-mono tracking-widest text-primary mb-3">{s.label}</p>
              <p className="text-base text-muted-foreground leading-relaxed">{s.text}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 flex gap-4 flex-wrap">
          <a
            href="#contact"
            className="border border-primary text-primary text-xs tracking-widest uppercase px-6 min-h-[44px] inline-flex items-center hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            BOOK SUBSPACE RESONATOR
          </a>
          <a
            href="#music"
            className="text-xs tracking-widest uppercase text-muted-foreground hover:text-primary transition-colors inline-flex items-center min-h-[44px]"
          >
            LISTEN →
          </a>
        </div>
      </div>
    </section>
  );
}
