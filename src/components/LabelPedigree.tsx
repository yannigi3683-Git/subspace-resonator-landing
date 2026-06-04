import { motion } from "framer-motion";
import labelGeomagnetic from "@/assets/label-geomagnetic-official.png";
import labelTimewarp from "@/assets/label-timewarp-official.png";
import labelGoaRecords from "@/assets/label-goa-records-official.png";
import labelSpiralTrax from "@/assets/label-spiral-trax-official.png";

const labels = [
  { name: "Geomagnetic", url: "https://geodistro.bandcamp.com/", logo: labelGeomagnetic },
  { name: "Timewarp", url: "https://timewarprecords.bandcamp.com/", logo: labelTimewarp },
  { name: "Goa Records", url: "https://goarecords.bandcamp.com/", logo: labelGoaRecords },
  { name: "Spiral Trax", url: "https://spiraltrax.bandcamp.com/", logo: labelSpiralTrax },
];

const LabelPedigree = () => {
  return (
    <section id="labels" aria-label="Labels" className="py-10 md:py-16 border-t border-border">
      <div className="container">
        <h2 className="text-sm tracking-[0.3em] text-primary mb-8 uppercase">
          // RESONANCE NETWORK
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {labels.map((label, i) => (
            <motion.a
              key={i}
              href={label.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center border border-border p-2 md:p-3 hover:border-primary transition-all duration-300 aspect-square hover:shadow-[0_0_24px_hsl(var(--primary)/0.5),inset_0_0_24px_hsl(var(--primary)/0.15)]"
              style={{ background: "hsl(0,0%,3%)" }}
              whileHover={{ y: -2 }}
            >
              <img
                src={label.logo}
                alt={label.name}
                width={1024}
                height={1024}
                className="w-full h-full object-contain opacity-95 group-hover:opacity-100 transition-opacity duration-300"
                loading="lazy"
              />
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LabelPedigree;
