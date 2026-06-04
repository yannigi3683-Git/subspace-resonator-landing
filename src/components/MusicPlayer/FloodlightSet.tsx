import { useEffect, useRef, useState } from "react";

export default function FloodlightSet({ playing = false, side = "left" }: { playing?: boolean; side?: "left" | "right" }) {
  const [wobble, setWobble] = useState(0);
  const [hiPulse, setHiPulse] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!playing) { setWobble(0); setHiPulse(0); return; }
    const offset = side === "right" ? 1.3 : 0;
    const animate = () => {
      const now = performance.now() / 1000;
      const bps = 145 / 60;
      const kickPhase = (now * bps) % 1;
      const kick = kickPhase < 0.12 ? Math.pow(1 - kickPhase / 0.12, 3) : 0;
      const sub = Math.pow(Math.max(0, Math.sin(now * Math.PI * 2 * (bps / 2) + offset)), 2) * 0.3;
      setWobble(kick + sub);
      const hiPhase = ((now * bps) + 0.5) % 1;
      const hi = hiPhase < 0.08 ? Math.pow(1 - hiPhase / 0.08, 4) : 0;
      setHiPulse(hi);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, side]);

  const pulse = playing ? wobble * 0.7 : 0;
  const tweeterPulse = playing ? hiPulse * 0.6 : 0;

  return (
    <div className="flex flex-col items-center gap-0.5" aria-hidden="true">
      <div
        data-cabinet=""
        className="flex flex-col gap-[2px] p-[3px]"
        style={{
          width: 56,
          background: "linear-gradient(180deg, hsl(220,20%,18%), hsl(220,18%,10%))",
          border: "1.5px solid hsl(220,15%,28%)",
          boxShadow: "0 2px 10px hsl(0,0%,0%/0.5), inset 0 1px 0 hsl(220,15%,30%)",
        }}
      >
        {/* Horn / HF driver */}
        <div className="flex items-center justify-center" style={{ height: 22, background: "hsl(0,0%,6%)", border: "1px solid hsl(0,0%,22%)" }}>
          <svg width="32" height="14" viewBox="0 0 32 14">
            <path d="M8,0 L24,0 L30,14 L2,14 Z" fill={`hsl(0,0%,${10 + tweeterPulse * 18}%)`} stroke="hsl(0,0%,26%)" strokeWidth="0.5" />
            <rect x="12" y="1" width="8" height="4" rx="0.5" fill={`hsl(0,0%,${14 + tweeterPulse * 22}%)`} stroke="hsl(0,0%,28%)" strokeWidth="0.3" />
          </svg>
        </div>

        {/* Woofer */}
        <div className="flex items-center justify-center" style={{ height: 34, background: "hsl(0,0%,6%)", border: "1px solid hsl(0,0%,22%)" }}>
          <svg width="30" height="30" viewBox="0 0 30 30">
            <circle cx="15" cy="15" r="13" fill="none" stroke="hsl(0,0%,28%)" strokeWidth="0.8" />
            <defs>
              <radialGradient id={`cone-${side}`} cx="45%" cy="40%">
                <stop offset="0%" stopColor={`hsl(0,0%,${26 + pulse * 12}%)`} />
                <stop offset="60%" stopColor={`hsl(0,0%,${14 + pulse * 6}%)`} />
                <stop offset="100%" stopColor="hsl(0,0%,7%)" />
              </radialGradient>
            </defs>
            <g transform={`translate(15,15) scale(${1 + pulse * 0.08}) translate(-15,-15)`}>
              <circle cx="15" cy="15" r="12" fill={`url(#cone-${side})`} />
              {[0, 60, 120, 180, 240, 300].map(angle => (
                <line key={angle} x1="15" y1="15"
                  x2={15 + 11 * Math.cos(angle * Math.PI / 180)}
                  y2={15 + 11 * Math.sin(angle * Math.PI / 180)}
                  stroke="hsl(0,0%,20%)" strokeWidth="0.3" />
              ))}
            </g>
            <g transform={`translate(15,15) scale(${1 + pulse * 0.18}) translate(-15,-15)`}>
              <circle cx="15" cy="15" r="4" fill={`hsl(0,0%,${18 + pulse * 16}%)`} stroke="hsl(0,0%,30%)" strokeWidth="0.5" />
              <circle cx="14" cy="14" r="1.5" fill="hsl(0,0%,32%)" opacity="0.35" />
            </g>
          </svg>
        </div>

        {/* Brand strip */}
        <div className="flex items-center justify-center" style={{ height: 10, background: "hsl(220,18%,13%)" }}>
          <span className="text-[6px] text-foreground/80 tracking-[0.2em] uppercase font-medium">turbosound</span>
        </div>
      </div>
      <span className="text-[8px] text-foreground/60 tracking-[0.2em] font-medium">
        {side === "left" ? "TF-L" : "TF-R"}
      </span>
    </div>
  );
}
