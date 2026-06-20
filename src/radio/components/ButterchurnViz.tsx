import { useEffect, useRef } from 'react';

interface ButterchurnVizProps {
  getAudioContext: () => AudioContext | null;
  getAudioSource: () => AudioNode | null;
  /** Render only while the broadcast audio is actually playing. */
  active: boolean;
  /** Seconds between preset changes. */
  cycleSeconds?: number;
}

// MilkDrop 2 visualizer (Butterchurn) — the highest-rated Winamp visualizer, ported to WebGL.
// Lazy-loaded so the heavy lib + preset pack are a separate chunk only on the live room.
// Auto-cycles presets with blend transitions for the "overwhelming" psychedelic effect.
// Falls back to nothing (caller shows the lightweight canvas) on reduced-motion or no WebGL.
export function ButterchurnViz({ getAudioContext, getAudioSource, active, cycleSeconds = 18 }: ButterchurnVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) return;

    const canvas = canvasRef.current;
    const ctx = getAudioContext();
    const source = getAudioSource();
    if (!canvas || !ctx || !source) return;

    let cancelled = false;
    let raf = 0;
    let cycle: ReturnType<typeof setInterval> | null = null;
    let onResize: (() => void) | null = null;

    (async () => {
      try {
        const [bcMod, presetsMod] = await Promise.all([
          import('butterchurn'),
          import('butterchurn-presets'),
        ]);
        if (cancelled) return;
        const butterchurn = bcMod.default ?? bcMod;
        const presetsApi = presetsMod.default ?? presetsMod;
        const presets = presetsApi.getPresets();
        const names = Object.keys(presets);
        if (!names.length) return;

        const dpr = Math.min(1.5, window.devicePixelRatio || 1);
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;

        const viz = butterchurn.createVisualizer(ctx, canvas, {
          width: w,
          height: h,
          pixelRatio: dpr,
          textureRatio: 1,
        });
        viz.connectAudio(source);

        const pick = () => names[Math.floor(Math.random() * names.length)];
        viz.loadPreset(presets[pick()], 0.0);
        cycle = setInterval(() => {
          if (!document.hidden && !cancelled) viz.loadPreset(presets[pick()], 5.0);
        }, cycleSeconds * 1000);

        onResize = () => {
          const ww = canvas.clientWidth || window.innerWidth;
          const hh = canvas.clientHeight || window.innerHeight;
          viz.setRendererSize(ww, hh);
        };
        window.addEventListener('resize', onResize);

        const render = () => {
          if (cancelled) return;
          if (!document.hidden) viz.render();
          raf = requestAnimationFrame(render);
        };
        render();
      } catch {
        // No WebGL / load failure — caller's lightweight fallback remains visible.
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (cycle) clearInterval(cycle);
      if (onResize) window.removeEventListener('resize', onResize);
    };
  }, [active, getAudioContext, getAudioSource, cycleSeconds]);

  return <canvas ref={canvasRef} className="w-full h-full" aria-hidden="true" />;
}
