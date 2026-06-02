import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useGallery } from '../lib/siteContent';

export default function GallerySection() {
  const images = useGallery();
  const looped = [...images, ...images];
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollPos = useRef(0);
  const rafId = useRef<number>();

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Auto-scroll rAF
  useEffect(() => {
    if (prefersReduced) return;
    const container = containerRef.current;
    if (!container) return;
    let paused = false;

    const onMouseEnter = () => { paused = true; };
    const onMouseLeave = () => { paused = false; };
    container.addEventListener('mouseenter', onMouseEnter);
    container.addEventListener('mouseleave', onMouseLeave);

    function frame() {
      if (!paused && container) {
        scrollPos.current += 0.5;
        const half = container.scrollWidth / 2;
        if (scrollPos.current >= half) scrollPos.current = 0;
        container.scrollLeft = scrollPos.current;
      }
      rafId.current = requestAnimationFrame(frame);
    }
    rafId.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId.current!);
      container.removeEventListener('mouseenter', onMouseEnter);
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [prefersReduced]);

  const closeLightbox = useCallback(() => {
    const idx = lightboxIndex;
    setLightboxIndex(null);
    if (idx !== null) {
      setTimeout(() => triggerRefs.current[idx % images.length]?.focus(), 0);
    }
  }, [lightboxIndex, images.length]);

  // Keyboard nav for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    setTimeout(() => closeButtonRef.current?.focus(), 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') setLightboxIndex((i) => i !== null ? (i + 1) % images.length : null);
      if (e.key === 'ArrowLeft')  setLightboxIndex((i) => i !== null ? (i - 1 + images.length) % images.length : null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxIndex, closeLightbox, images.length]);

  const openLightbox = useCallback((realIndex: number) => {
    setLightboxIndex(realIndex % images.length);
  }, [images.length]);

  return (
    <section id="gallery" aria-label="Gallery" className="py-20 border-t border-border overflow-hidden">
      <div className="container mb-8">
        <p className="text-xs font-mono tracking-widest text-primary">// ARCHIVE</p>
      </div>

      {/* Scrolling strip */}
      <div ref={containerRef} className="flex gap-3 overflow-x-hidden">
        {looped.map((img, i) => {
          const realIndex = i % images.length;
          return (
            <button
              key={`loop-${i}`}
              ref={(el) => { if (i < images.length) triggerRefs.current[i] = el; }}
              onClick={() => openLightbox(realIndex)}
              className="flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              aria-label={`Open ${img.alt}`}
            >
              <img
                src={img.src}
                alt={img.alt}
                loading={i < 4 ? 'eager' : 'lazy'}
                className="h-48 w-auto object-cover"
              />
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && images[lightboxIndex] && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Image viewer"
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLightbox}
          >
            <motion.div
              className="relative max-w-4xl w-full mx-4"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
            >
              <button
                ref={closeButtonRef}
                onClick={closeLightbox}
                aria-label="Close image viewer"
                className="absolute -top-12 right-0 w-11 h-11 flex items-center justify-center text-white hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <X size={24} />
              </button>

              <img
                src={images[lightboxIndex].src}
                alt={images[lightboxIndex].alt}
                className="w-full h-auto max-h-[80vh] object-contain"
              />

              <div className="absolute inset-y-0 left-0 flex items-center">
                <button
                  onClick={() => setLightboxIndex((i) => i !== null ? (i - 1 + images.length) % images.length : null)}
                  aria-label="Previous image"
                  className="w-11 h-11 flex items-center justify-center bg-black/50 text-white hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <ChevronLeft size={24} />
                </button>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center">
                <button
                  onClick={() => setLightboxIndex((i) => i !== null ? (i + 1) % images.length : null)}
                  aria-label="Next image"
                  className="w-11 h-11 flex items-center justify-center bg-black/50 text-white hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
