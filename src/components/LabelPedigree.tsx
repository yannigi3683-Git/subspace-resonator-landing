import { motion } from 'framer-motion';
import geoImg from '../assets/label-geomagnetic-official.png';
import timewarpImg from '../assets/label-timewarp-official.png';
import goaImg from '../assets/label-goa-records-official.png';
import spiralImg from '../assets/label-spiral-trax-official.png';

const labels = [
  { name: 'Geomagnetic', url: 'https://geodistro.bandcamp.com/',       releases: 3, years: '2001–2024', img: geoImg     },
  { name: 'Timewarp',    url: 'https://timewarprecords.bandcamp.com/', releases: 2, years: '2003–2006', img: timewarpImg },
  { name: 'Goa Records', url: 'https://goarecords.bandcamp.com/',      releases: 1, years: '2023',      img: goaImg      },
  { name: 'Spiral Trax', url: 'https://spiraltrax.bandcamp.com/',      releases: 2, years: '1999–2002', img: spiralImg   },
];

export default function LabelPedigree() {
  return (
    <section id="labels" aria-label="Labels" className="py-20 border-t border-border">
      <div className="container">
        <p className="text-xs font-mono tracking-widest text-primary mb-1">// RESONANCE NETWORK</p>
        <p className="text-xs tracking-widest text-muted-foreground uppercase mb-12">RELEASED ON</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {labels.map((label) => (
            <motion.a
              key={label.name}
              href={label.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${label.name} Records on Bandcamp`}
              className="flex flex-col items-center gap-4 p-6 border border-border hover:border-primary transition-colors"
              whileHover={{ y: -2 }}
            >
              <img
                src={label.img}
                alt={label.name}
                width={120}
                height={120}
                className="object-contain aspect-square"
              />
              <div className="text-center">
                <p className="text-xs tracking-widest uppercase font-display font-medium">{label.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{label.releases} releases · {label.years}</p>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
