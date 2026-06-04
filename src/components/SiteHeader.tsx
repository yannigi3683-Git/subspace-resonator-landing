import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import heroLogo from "@/assets/bio-watermark.jpg";

const navItems = [
  { label: "MUSIC",   href: "#music" },
  { label: "LABELS",  href: "#labels" },
  { label: "BIO",     href: "#bio" },
  { label: "BOOKING", href: "#contact" },
  { label: "ARCHIVE", href: "#gallery" },
  { label: "CONNECT", href: "#connect" },
];

const SiteHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMenuOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="glass-header fixed top-0 left-0 right-0 z-50">
      <div className="container flex items-center h-14 gap-2">
        <a
          href="#hero"
          onClick={(e) => handleNav(e, "#hero")}
          aria-label="Subspace Resonator — back to top"
          className="min-h-[44px] flex items-center shrink-0"
        >
          <img src={heroLogo} alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
        </a>

        <div className="flex-1" />

        {/* Desktop nav */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-0">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => handleNav(e, item.href)}
              className="nav-link"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Mobile hamburger */}
        <button
          className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-foreground"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            id="mobile-nav"
            aria-label="Mobile navigation"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="md:hidden overflow-hidden border-t border-border"
            style={{ background: "hsla(0,0%,1%,0.95)" }}
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNav(e, item.href)}
                className="nav-link w-full text-left px-6"
              >
                {item.label}
              </a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
};

export default SiteHeader;
