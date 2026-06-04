import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useGallery } from "@/lib/siteContent";

const GallerySection = () => {
  const galleryImages = useGallery();
  const [selected, setSelected] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isPaused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const speed = 0.5;
    let raf: number;

    const scroll = () => {
      el.scrollLeft += speed;
      if (el.scrollLeft >= el.scrollWidth / 2) {
        el.scrollLeft = 0;
      }
      raf = requestAnimationFrame(scroll);
    };

    raf = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(raf);
  }, [isPaused]);

  const closeSelected = useCallback(() => {
    setSelected(null);
    lastFocusedRef.current?.focus();
  }, []);

  // Move focus into lightbox when it opens + lock body scroll
  useEffect(() => {
    if (selected !== null) {
      closeBtnRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [selected]);

  // Keyboard nav + Tab trap inside lightbox
  useEffect(() => {
    if (selected === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelected((s) => (s === null ? null : (s + 1) % galleryImages.length));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelected((s) => (s === null ? null : (s - 1 + galleryImages.length) % galleryImages.length));
      } else if (e.key === "Escape") {
        closeSelected();
      } else if (e.key === "Tab") {
        // Trap focus inside the dialog
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute("disabled"));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, galleryImages.length, closeSelected]);

  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  const loopImages = [...galleryImages, ...galleryImages];

  return (
    <section id="gallery" aria-label="Gallery" className="py-10 md:py-20 border-t border-border">
      <div className="container">
        <h2 className="text-xs tracking-[0.3em] text-primary mb-8 uppercase">
          // VISUAL ARCHIVE
        </h2>
      </div>

      <div
        className="relative group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <button
          onClick={() => scrollBy(-1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-background/80 border border-border text-foreground hover:text-primary transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100"
          aria-label="Scroll left"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={() => scrollBy(1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-background/80 border border-border text-foreground hover:text-primary transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100"
          aria-label="Scroll right"
        >
          <ChevronRight size={18} />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-2 overflow-x-hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {loopImages.map((img, i) => (
            <button
              key={i}
              onClick={(e) => {
                lastFocusedRef.current = e.currentTarget;
                setSelected(i % galleryImages.length);
              }}
              aria-label={`View image: ${img.alt}`}
              className="shrink-0 border border-border overflow-hidden h-56 md:h-72 w-80 md:w-96 hover:border-primary/50 transition-colors"
            >
              <img
                src={img.src}
                alt={img.alt}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected !== null && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Image viewer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-background/95 flex items-center justify-center p-4"
            onClick={closeSelected}
          >
            <button
              ref={closeBtnRef}
              className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground hover:text-primary"
              onClick={closeSelected}
              aria-label="Close lightbox"
            >
              <X size={24} />
            </button>

            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground hover:text-primary bg-background/60 border border-border"
              onClick={(e) => { e.stopPropagation(); setSelected((s) => (s === null ? null : (s - 1 + galleryImages.length) % galleryImages.length)); }}
              aria-label="Previous image"
            >
              <ChevronLeft size={24} />
            </button>

            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-foreground hover:text-primary bg-background/60 border border-border"
              onClick={(e) => { e.stopPropagation(); setSelected((s) => (s === null ? null : (s + 1) % galleryImages.length)); }}
              aria-label="Next image"
            >
              <ChevronRight size={24} />
            </button>

            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={galleryImages[selected].src}
              alt={galleryImages[selected].alt}
              className="max-w-full max-h-[85vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default GallerySection;
