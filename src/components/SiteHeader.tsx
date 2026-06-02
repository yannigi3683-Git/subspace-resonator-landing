import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import bioWatermark from '../assets/bio-watermark.jpg';

const navItems = [
  { label: 'MUSIC',   href: '#music'   },
  { label: 'LABELS',  href: '#labels'  },
  { label: 'BIO',     href: '#bio'     },
  { label: 'ARCHIVE', href: '#gallery' },
  { label: 'SOCIAL',  href: '#connect' },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-header">
      <div className="container flex items-center justify-between h-14">
        <a href="#" aria-label="Subspace Resonator — home">
          <img src={bioWatermark} alt="Subspace Resonator logo" className="h-8 w-8 rounded-full object-cover" />
        </a>

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="nav-link">
              {item.label}
            </a>
          ))}
          <a
            href="#contact"
            className="ml-4 px-4 min-h-[44px] flex items-center border border-primary text-primary text-xs tracking-widest uppercase hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            BOOK
          </a>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-primary"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={toggle}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden md:hidden border-t border-border"
            aria-label="Mobile navigation"
          >
            <div className="container py-2 flex flex-col">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="nav-link py-3"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#contact"
                className="mt-2 mb-3 px-4 min-h-[44px] flex items-center border border-primary text-primary text-xs tracking-widest uppercase"
                onClick={() => setOpen(false)}
              >
                BOOK
              </a>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
