import { useEffect, useRef, useState } from "react";

const bands = 14;
const segments = 12;

export default function SpectrumAnalyzer({
  playing = false,
  label = "",
  trackIndex,
  volume,
}: {
  playing?: boolean;
  label?: string;
  trackIndex?: number;
  volume?: number;
}) {
  const levelsRef = useRef<number[]>(Array(bands).fill(0));
  const smoothRef = useRef<number[]>(Array(bands).fill(0));
  const peaksRef = useRef<number[]>(Array(bands).fill(0));
  const peakHoldRef = useRef<number[]>(Array(bands).fill(0));
  const [renderLevels, setRenderLevels] = useState<number[]>(Array(bands).fill(0));
  const [renderPeaks, setRenderPeaks] = useState<number[]>(Array(bands).fill(0));
  const rafRef = useRef<number>();
  const channelOffset = label === "CH-R" ? 1.7 : 0;

  useEffect(() => {
    if (!playing) {
      const decay = () => {
        let anyActive = false;
        const newSmooth = smoothRef.current.map(v => {
          const next = v * 0.85;
          if (next > 0.3) anyActive = true;
          return next;
        });
        smoothRef.current = newSmooth;
        const newLevels = newSmooth.map(v => Math.round(v));
        setRenderLevels(newLevels);
        const newPeaks = peaksRef.current.map((p, i) => {
          if (p > newLevels[i]) return p - 1;
          return p;
        });
        peaksRef.current = newPeaks.map(p => Math.max(0, p));
        setRenderPeaks([...peaksRef.current]);
        if (anyActive) rafRef.current = requestAnimationFrame(decay);
      };
      rafRef.current = requestAnimationFrame(decay);
      return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }

    const seed = (trackIndex ?? 0) * 137.5;
    const volScale = (volume ?? 70) / 100;

    const bandProfiles = Array(bands).fill(0).map((_, i) => {
      const freq = i / (bands - 1);
      return {
        baseEnergy: freq < 0.15 ? 0.85 : freq < 0.3 ? 0.75 : freq < 0.5 ? 0.5 : freq < 0.7 ? 0.4 : 0.55,
        speed: 80 + freq * 300,
        chaos: 0.1 + freq * 0.4,
        smoothing: 0.7 - freq * 0.35,
      };
    });

    let lastTime = performance.now();
    let beatPhase = 0;
    const bpm = 145 + (seed % 20);

    const animate = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      beatPhase += dt * (bpm / 60) * Math.PI * 2;
      const kick = Math.pow(Math.max(0, Math.cos(beatPhase)), 4);
      const offbeat = Math.pow(Math.max(0, Math.cos(beatPhase + Math.PI)), 3);
      const bar = Math.sin(beatPhase / 8);

      const targetLevels = bandProfiles.map((bp, i) => {
        const t = now / bp.speed + seed + i * 2.3 + channelOffset;
        const osc1 = Math.sin(t) * 0.4;
        const osc2 = Math.sin(t * 2.3 + 1.1) * 0.2;
        const osc3 = Math.sin(t * 0.7 + 3.3) * 0.15;
        const noise = (Math.random() - 0.5) * bp.chaos;
        const freq = i / (bands - 1);
        const kickInfluence = freq < 0.3 ? kick * 0.4 * (1 - freq * 3) : 0;
        const hatInfluence = freq > 0.6 ? offbeat * 0.3 * (freq - 0.6) * 2.5 : 0;
        const barMod = bar * 0.1;
        const raw = bp.baseEnergy + osc1 + osc2 + osc3 + noise + kickInfluence + hatInfluence + barMod;
        return Math.max(0, Math.min(1, raw)) * volScale;
      });

      smoothRef.current = smoothRef.current.map((prev, i) => {
        const target = targetLevels[i] * segments;
        const sm = bandProfiles[i].smoothing;
        return target > prev ? prev + (target - prev) * (1 - sm * 0.5) : prev + (target - prev) * (1 - sm);
      });

      const quantized = smoothRef.current.map(v => Math.round(Math.max(0, Math.min(segments, v))));
      levelsRef.current = quantized;
      setRenderLevels([...quantized]);

      const newPeaks = [...peaksRef.current];
      const newHold = [...peakHoldRef.current];
      for (let i = 0; i < bands; i++) {
        if (quantized[i] >= newPeaks[i]) {
          newPeaks[i] = quantized[i];
          newHold[i] = now;
        } else if (now - newHold[i] > 400) {
          newPeaks[i] = Math.max(quantized[i], newPeaks[i] - 0.5);
        }
      }
      peaksRef.current = newPeaks;
      peakHoldRef.current = newHold;
      setRenderPeaks(newPeaks.map(p => Math.round(p)));

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, trackIndex, volume, channelOffset]);

  const getSegmentColor = (segIdx: number) => {
    if (segIdx >= 10) return "hsl(0, 80%, 50%)";
    if (segIdx >= 8) return "hsl(15, 90%, 50%)";
    if (segIdx >= 6) return "hsl(35, 100%, 50%)";
    if (segIdx >= 4) return "hsl(50, 100%, 50%)";
    return "hsl(var(--primary))";
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className="flex items-end gap-[1.5px] h-14 lg:h-[72px] px-1.5 py-1.5 border border-border"
        style={{ background: "hsl(0,0%,2%)" }}
      >
        {renderLevels.map((level, bandIdx) => (
          <div key={bandIdx} data-bar="" className="flex flex-col-reverse gap-[1px] w-[3px] lg:w-[4px]" style={{ height: "100%" }}>
            {Array.from({ length: segments }).map((_, segIdx) => {
              const active = segIdx < level;
              const isPeak = segIdx === renderPeaks[bandIdx] && renderPeaks[bandIdx] > 0 && !active;
              return (
                <div
                  key={segIdx}
                  className="flex-1"
                  style={{
                    background: active ? getSegmentColor(segIdx) : isPeak ? getSegmentColor(segIdx) : "hsl(0,0%,6%)",
                    boxShadow: active ? `0 0 2px ${getSegmentColor(segIdx)}30` : "none",
                    opacity: isPeak ? 0.7 : 1,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <span className="text-[9px] lg:text-[10px] text-muted-foreground mt-0.5 tracking-widest">{label}</span>
    </div>
  );
}
