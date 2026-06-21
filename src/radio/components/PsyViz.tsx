import { useEffect, useRef } from 'react';

const TARGET_MS = 1000 / 30;
const STEPS = 1500;
const MAX_THETA = 20 * Math.PI;

// Three overlapping hypotrochoids with slowly drifting parameters.
const CURVES = [
  { R: 0.40, r: 0.14, d: 0.26, pR: 0.0, pD: 0.9 },
  { R: 0.33, r: 0.11, d: 0.20, pR: 1.3, pD: 2.1 },
  { R: 0.48, r: 0.17, d: 0.33, pR: 2.7, pD: 0.4 },
];

export function PsyViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let raf = 0;
    let lastFrame = 0;

    const resize = () => {
      const size = Math.min(canvas.clientWidth, canvas.clientHeight) || 300;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.fillStyle = '#05060f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (now - lastFrame < TARGET_MS) return;
      lastFrame = now;

      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) return;
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h) * 0.46;
      const t = now * 0.001;

      // Fade trail — older marks dissolve slowly, new paths glow on top.
      ctx.fillStyle = 'rgba(5,6,15,0.04)';
      ctx.fillRect(0, 0, w, h);

      for (let ci = 0; ci < CURVES.length; ci++) {
        const c = CURVES[ci];
        const R = (c.R + Math.sin(t * 0.23 + c.pR) * 0.05) * scale;
        const r = (c.r + Math.sin(t * 0.37 + c.pR + 1) * 0.02) * scale;
        const d = (c.d + Math.sin(t * 0.31 + c.pD) * 0.07) * scale;

        const hue = ((t * 6 + ci * 90 + 180) % 360 + 360) % 360;
        ctx.strokeStyle = `hsla(${hue}, 85%, 62%, 0.55)`;
        ctx.lineWidth = Math.max(1, w * 0.003);
        ctx.beginPath();

        for (let i = 0; i <= STEPS; i++) {
          const theta = (i / STEPS) * MAX_THETA;
          const x = cx + (R - r) * Math.cos(theta) + d * Math.cos(((R - r) / r) * theta);
          const y = cy + (R - r) * Math.sin(theta) - d * Math.sin(((R - r) / r) * theta);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" aria-hidden="true" />;
}
