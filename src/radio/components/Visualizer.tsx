import { useEffect, useRef } from 'react';

interface VisualizerProps {
  getFrequencyData: () => Uint8Array | null;
}

// Radial spectrum visualizer for the empty centre of the dancefloor. Reads the listener's
// live frequency data and draws a bass-reactive cosmic core + ring of frequency bars.
// Pure canvas (transform-free), respects prefers-reduced-motion, and no-ops where canvas
// 2D isn't available (tests / SSR).
export function Visualizer({ getFrequencyData }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getRef = useRef(getFrequencyData);
  getRef.current = getFrequencyData;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let raf = 0;

    const resize = () => {
      const size = Math.min(canvas.clientWidth, canvas.clientHeight) || 300;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      ctx.clearRect(0, 0, w, h);

      const bins = getRef.current() ?? new Uint8Array(64);
      const N = 64;
      const baseR = Math.min(w, h) * 0.16;

      let bass = 0;
      for (let i = 0; i < 8; i++) bass += bins[i] || 0;
      bass /= 8 * 255; // 0..1

      // Cosmic core glow, pulsing with the low end.
      const coreR = baseR * (0.7 + bass * 0.6);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.6);
      grad.addColorStop(0, `rgba(123,47,190,${0.30 + bass * 0.45})`);
      grad.addColorStop(0.5, `rgba(38,198,218,${0.10 + bass * 0.22})`);
      grad.addColorStop(1, 'rgba(5,6,15,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // Ring of frequency bars.
      ctx.lineCap = 'round';
      const lineW = Math.max(2, w * 0.006);
      for (let i = 0; i < N; i++) {
        const v = (bins[i % bins.length] || 0) / 255;
        const ang = (i / N) * Math.PI * 2 - Math.PI / 2;
        const r0 = baseR;
        const r1 = baseR + v * baseR * 1.9 + lineW;
        ctx.strokeStyle = `hsl(${190 + v * 90}, 90%, ${50 + v * 18}%)`;
        ctx.lineWidth = lineW;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
        ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
        ctx.stroke();
      }

      if (!reduce) raf = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" aria-hidden="true" />;
}
