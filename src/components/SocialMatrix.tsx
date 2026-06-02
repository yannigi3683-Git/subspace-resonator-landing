import { motion } from 'framer-motion';
import { Music2, Youtube, Instagram } from 'lucide-react';
import { ReactNode } from 'react';

function getIcon(name: string): ReactNode {
  if (name === 'SoundCloud' || name === 'Spotify' || name === 'Bandcamp')
    return <Music2 size={14} className="mr-2" />;
  if (name === 'YouTube') return <Youtube size={14} className="mr-2" />;
  if (name === 'Instagram') return <Instagram size={14} className="mr-2" />;
  if (name === 'Facebook') return <span className="font-mono text-xs mr-2">FB</span>;
  if (name === 'TikTok') return <span className="font-mono text-xs mr-2">TK</span>;
  if (name === 'Discogs') return <span className="font-mono text-xs mr-2">DC</span>;
  return null;
}

type SocialLink = { name: string; url: string };
type SocialGroup = { label: string; links: SocialLink[] };

const socialGroups: SocialGroup[] = [
  {
    label: 'STREAM',
    links: [
      { name: 'SoundCloud', url: 'https://soundcloud.com/subspaceresonance' },
      { name: 'Spotify',    url: 'https://open.spotify.com/artist/0UQWUdUuQ3NhMCACj4UXlk' },
      { name: 'Bandcamp',   url: 'https://yannig.bandcamp.com/' },
      { name: 'YouTube',    url: 'https://www.youtube.com/@SubspaceResonator' },
    ],
  },
  {
    label: 'FOLLOW',
    links: [
      { name: 'Instagram', url: 'https://www.instagram.com/subspace_resonator' },
      { name: 'Facebook',  url: 'https://facebook.com/profile.php?id=61559198105695' },
      { name: 'TikTok',    url: 'https://www.tiktok.com/@subspace.resonator' },
    ],
  },
  {
    label: 'CATALOGUE',
    links: [
      { name: 'Discogs', url: 'https://www.discogs.com/artist/15101171-Subspace-Resonator' },
    ],
  },
];

export default function SocialMatrix() {
  return (
    <section id="connect" aria-label="Social" className="py-20 border-t border-border">
      <div className="container">
        <p className="text-xs font-mono tracking-widest text-primary mb-12">// SIGNAL NETWORK</p>

        <div className="space-y-10">
          {socialGroups.map((group) => (
            <div key={group.label}>
              <p className="text-xs tracking-widest text-muted-foreground uppercase mb-4">{group.label}</p>
              <div className="flex flex-wrap gap-3">
                {group.links.map((link) => (
                  <motion.a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.name}
                    className="flex items-center min-h-[44px] px-4 border border-border text-xs tracking-widest text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    whileHover={{ y: -1 }}
                  >
                    {getIcon(link.name)}
                    {link.name}
                  </motion.a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
