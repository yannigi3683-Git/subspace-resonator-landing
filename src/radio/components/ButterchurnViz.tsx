import { useEffect, useRef, useState } from 'react';

interface ButterchurnVizProps {
  getAudioContext: () => AudioContext | null;
  getAudioSource: () => AudioNode | null;
  /** Render only while the broadcast audio is actually playing. */
  active: boolean;
  /** Seconds between preset changes. */
  cycleSeconds?: number;
  /** Called when init fails (no WebGL / load error) so the caller can show a fallback. */
  onFailed?: () => void;
}

// MilkDrop 2 visualizer (Butterchurn) — the highest-rated Winamp visualizer, ported to WebGL.
// Lazy-loaded so the heavy lib + preset pack are a separate chunk only on the live room.
// Auto-cycles presets with blend transitions for the "overwhelming" psychedelic effect.
// Any failure (no WebGL, chunk load error, render throw) is surfaced — never swallowed —
// so the caller's lightweight fallback can take over and the cause is visible in the console.
export function ButterchurnViz({ getAudioContext, getAudioSource, active, cycleSeconds = 18, onFailed }: ButterchurnVizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;
  const fail = () => { setFailed(true); onFailedRef.current?.(); };

  useEffect(() => {
    if (!active) return;
    // prefers-reduced-motion intentionally ignored — opt-in psychedelic experience.
    const canvas = canvasRef.current;
    const ctx = getAudioContext();
    const source = getAudioSource();
    if (!canvas || !ctx || !source) {
      console.warn('[butterchurn] missing prerequisite', { canvas: !!canvas, ctx: !!ctx, source: !!source });
      fail();
      return;
    }

    let cancelled = false;
    let raf = 0;
    let cycle: ReturnType<typeof setInterval> | null = null;
    let ro: ResizeObserver | null = null;

    const sizeOf = () => ({
      w: canvas.clientWidth || canvas.parentElement?.clientWidth || window.innerWidth,
      h: canvas.clientHeight || canvas.parentElement?.clientHeight || window.innerHeight,
    });

    (async () => {
      try {
        // A suspended context (autoplay not yet resumed) feeds the analyser silence; resume it.
        if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

        const [bcMod, presetsMod] = await Promise.all([
          import('butterchurn'),
          import('butterchurn-presets'),
        ]);
        if (cancelled) return;
        const butterchurn = bcMod.default ?? bcMod;
        const presetsApi = presetsMod.default ?? presetsMod;
        const presets = presetsApi.getPresets();
        const names = Object.keys(presets);
        if (!names.length) throw new Error('no presets');

        const dpr = Math.min(1.5, window.devicePixelRatio || 1);
        const { w, h } = sizeOf();

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

        ro = new ResizeObserver(() => {
          const s = sizeOf();
          if (s.w > 0 && s.h > 0) viz.setRendererSize(s.w, s.h);
        });
        ro.observe(canvas);

        let loggedRenderError = false;
        const render = () => {
          if (cancelled) return;
          if (!document.hidden) {
            try {
              viz.render();
            } catch (err) {
              // Surface the first failure, then keep trying (a transient frame error should
              // not permanently blank the visualizer).
              if (!loggedRenderError) {
                loggedRenderError = true;
                console.error('[butterchurn] render error', err);
              }
            }
          }
          raf = requestAnimationFrame(render);
        };
        render();
      } catch (err) {
        // No WebGL / chunk load failure / API change — show nothing here; the caller's
        // lightweight fallback remains visible. Surface the cause for debugging.
        console.error('[butterchurn] init failed', err);
        if (!cancelled) fail();
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (cycle) clearInterval(cycle);
      if (ro) ro.disconnect();
    };
  }, [active, getAudioContext, getAudioSource, cycleSeconds]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      aria-hidden="true"
      data-failed={failed ? 'true' : undefined}
    />
  );
}
