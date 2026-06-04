import { useEffect, useRef } from "react";

type Props = {
  bpm?: number;
  className?: string;
};

const HeroVisualizer = ({ bpm = 140, className }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const beatMs = 60000 / bpm;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const getPrimary = () => {
      const v = getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim();
      return v || "210 90% 55%";
    };
    let primaryHsl = getPrimary();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();

    const ro = new ResizeObserver(() => {
      resize();
      primaryHsl = getPrimary();
    });
    ro.observe(canvas);

    let visible = true;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible = e.isIntersecting;
      },
      { threshold: 0.01 },
    );
    io.observe(canvas);

    const t0 = performance.now();
    let raf = 0;

    type Ring = { born: number };
    const rings: Ring[] = [];
    let lastBeatIndex = -1;

    const draw = (now: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) / 2;

      ctx.clearRect(0, 0, w, h);

      const elapsed = now - t0;
      const beatF = elapsed / beatMs;
      const beatIndex = Math.floor(beatF);
      const phase = beatF - beatIndex;
      const env = Math.pow(1 - phase, 2.2);
      const halfPhase = (beatF * 2) % 1;
      const halfEnv = Math.pow(1 - halfPhase, 3);

      if (beatIndex !== lastBeatIndex) {
        lastBeatIndex = beatIndex;
        rings.push({ born: now });
        while (rings.length > 6) rings.shift();
      }

      // Concentric rings
      ctx.lineWidth = 1 * dpr;
      const ringCount = 7;
      for (let i = 0; i < ringCount; i++) {
        const r = R * (0.18 + (i / ringCount) * 0.78);
        const a = 0.08 + (i % 2 === 0 ? 0.05 : 0.02) + env * 0.12 * (1 - i / ringCount);
        ctx.strokeStyle = `hsla(210, 8%, 75%, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Rotating radial ticks
      const rot = (elapsed / (beatMs * 16)) * Math.PI * 2;
      const tickCount = 48;
      const tickInner = R * 0.62;
      const tickOuter = R * 0.96;
      ctx.strokeStyle = `hsla(210, 8%, 70%, ${(0.06 + halfEnv * 0.08).toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i < tickCount; i++) {
        const a = rot + (i / tickCount) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        ctx.moveTo(cx + c * tickInner, cy + s * tickInner);
        ctx.lineTo(cx + c * tickOuter, cy + s * tickOuter);
      }
      ctx.stroke();

      // Grid shimmer
      const gridAlpha = 0.04 + halfEnv * 0.05;
      ctx.strokeStyle = `hsla(210, 10%, 60%, ${gridAlpha.toFixed(3)})`;
      ctx.beginPath();
      const step = R * 0.16;
      for (let x = cx - R; x <= cx + R; x += step) {
        ctx.moveTo(x, cy - R);
        ctx.lineTo(x, cy + R);
      }
      for (let y = cy - R; y <= cy + R; y += step) {
        ctx.moveTo(cx - R, y);
        ctx.lineTo(cx + R, y);
      }
      ctx.stroke();

      // Expanding interference waves
      const maxRingLifeMs = beatMs * 2;
      const maxRingR = R * 1.05;
      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        const age = now - ring.born;
        if (age > maxRingLifeMs) { rings.splice(i, 1); continue; }
        const t = age / maxRingLifeMs;
        const r = t * maxRingR;
        const alpha = (1 - t) * 0.55;
        ctx.strokeStyle = `hsla(${primaryHsl} / ${alpha.toFixed(3)})`;
        ctx.lineWidth = (1 + (1 - t) * 1.5) * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = `hsla(${primaryHsl} / ${(alpha * 0.5).toFixed(3)})`;
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Core pulse
      const coreR = R * (0.34 + env * 0.06);
      const grad = ctx.createRadialGradient(cx, cy, coreR * 0.2, cx, cy, coreR);
      grad.addColorStop(0, `hsla(${primaryHsl} / ${(0.22 * env + 0.06).toFixed(3)})`);
      grad.addColorStop(1, `hsla(${primaryHsl} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `hsla(${primaryHsl} / ${(0.35 + env * 0.5).toFixed(3)})`;
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.34, 0, Math.PI * 2);
      ctx.stroke();
    };

    const loop = () => {
      if (visible) draw(performance.now());
      raf = requestAnimationFrame(loop);
    };

    if (reduced) {
      draw(performance.now());
    } else {
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [bpm]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none ${className ?? ""}`}
    />
  );
};

export default HeroVisualizer;
