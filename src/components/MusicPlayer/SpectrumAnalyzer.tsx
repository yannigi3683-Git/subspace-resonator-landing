import { useEffect, useRef } from 'react';

const BAR_COUNT = 32;
const UPDATE_INTERVAL_MS = 200;

export default function SpectrumAnalyzer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReduced) return;
    const container = containerRef.current;
    if (!container) return;

    const bars = Array.from(container.querySelectorAll<HTMLDivElement>('[data-bar]'));
    const current = bars.map(() => 40);
    const targets = bars.map(() => 40);
    let lastUpdate = performance.now();
    let rafId: number;

    function frame(now: number) {
      if (now - lastUpdate > UPDATE_INTERVAL_MS) {
        lastUpdate = now;
        for (let i = 0; i < bars.length; i++) {
          targets[i] = 20 + Math.random() * 80;
        }
      }
      for (let i = 0; i < bars.length; i++) {
        current[i] += (targets[i] - current[i]) * 0.12;
        bars[i].style.height = `${current[i]}%`;
        const ratio = (current[i] - 20) / 80;
        bars[i].style.backgroundColor =
          ratio > 0.5
            ? `hsl(var(--primary))`
            : `hsl(var(--muted-foreground))`;
      }
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [prefersReduced]);

  return (
    <div
      ref={containerRef}
      className="flex items-end gap-px w-full h-full"
      aria-hidden="true"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          data-bar
          className="flex-1 transition-none"
          style={{
            height: '40%',
            minWidth: '2px',
            backgroundColor: 'hsl(var(--muted-foreground))',
          }}
        />
      ))}
    </div>
  );
}
