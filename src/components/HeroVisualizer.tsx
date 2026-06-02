import { useEffect, useRef, useState } from 'react';

const BAR_COUNT = 48;
const RADIUS = 80;
const BAR_LENGTH_MIN = 8;
const BAR_LENGTH_MAX = 28;
const BPM = 140;
const BEAT_MS = (60 / BPM) * 1000;

export default function HeroVisualizer() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);
  }, []);

  useEffect(() => {
    if (prefersReduced) return;
    const bars: SVGLineElement[] = [];
    const svg = svgRef.current;
    if (!svg) return;

    for (let i = 0; i < BAR_COUNT; i++) {
      const angle = (i / BAR_COUNT) * Math.PI * 2;
      const x1 = 120 + Math.cos(angle) * RADIUS;
      const y1 = 120 + Math.sin(angle) * RADIUS;
      const x2 = 120 + Math.cos(angle) * (RADIUS + BAR_LENGTH_MIN);
      const y2 = 120 + Math.sin(angle) * (RADIUS + BAR_LENGTH_MIN);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(x1));
      line.setAttribute('y1', String(y1));
      line.setAttribute('x2', String(x2));
      line.setAttribute('y2', String(y2));
      line.setAttribute('stroke', 'hsl(202 100% 61%)');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('stroke-linecap', 'round');
      svg.appendChild(line);
      bars.push(line);
    }

    let targets = bars.map(() => BAR_LENGTH_MIN);
    const current = bars.map(() => BAR_LENGTH_MIN);
    let lastBeat = performance.now();
    let rafId: number;

    function frame(now: number) {
      if (now - lastBeat > BEAT_MS / 4) {
        lastBeat = now;
        targets = bars.map(
          () =>
            BAR_LENGTH_MIN +
            Math.random() * (BAR_LENGTH_MAX - BAR_LENGTH_MIN)
        );
      }
      bars.forEach((bar, i) => {
        current[i] += (targets[i] - current[i]) * 0.12;
        const angle = (i / BAR_COUNT) * Math.PI * 2;
        const x2 = 120 + Math.cos(angle) * (RADIUS + current[i]);
        const y2 = 120 + Math.sin(angle) * (RADIUS + current[i]);
        bar.setAttribute('x2', String(x2));
        bar.setAttribute('y2', String(y2));
      });
      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      bars.forEach((b) => b.remove());
    };
  }, [prefersReduced]);

  if (prefersReduced) {
    return (
      <svg
        ref={svgRef}
        viewBox="0 0 240 240"
        className="w-full h-full"
        aria-hidden="true"
      >
        <circle
          cx="120"
          cy="120"
          r={RADIUS}
          fill="none"
          stroke="hsl(202 100% 61% / 0.3)"
          strokeWidth="1"
        />
        {Array.from({ length: BAR_COUNT }, (_, i) => {
          const angle = (i / BAR_COUNT) * Math.PI * 2;
          const len = BAR_LENGTH_MIN + 6;
          return (
            <line
              key={i}
              x1={120 + Math.cos(angle) * RADIUS}
              y1={120 + Math.sin(angle) * RADIUS}
              x2={120 + Math.cos(angle) * (RADIUS + len)}
              y2={120 + Math.sin(angle) * (RADIUS + len)}
              stroke="hsl(202 100% 61%)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    );
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 240 240"
      className="w-full h-full"
      aria-hidden="true"
    >
      <circle
        cx="120"
        cy="120"
        r={RADIUS}
        fill="none"
        stroke="hsl(202 100% 61% / 0.3)"
        strokeWidth="1"
      />
    </svg>
  );
}
