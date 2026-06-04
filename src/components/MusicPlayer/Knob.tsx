import { useEffect, useRef } from "react";

export default function Knob({
  label,
  value,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: number;
  onChange?: (v: number) => void;
  ariaLabel?: string;
}) {
  const knobRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastY = useRef(0);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!onChange) return;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") {
      e.preventDefault();
      onChange(Math.min(100, value + 5));
    } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
      e.preventDefault();
      onChange(Math.max(0, value - 5));
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onChange) return;
    dragging.current = true;
    lastY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !onChange) return;
    const delta = lastY.current - e.clientY;
    lastY.current = e.clientY;
    onChange(Math.round(Math.max(0, Math.min(100, value + delta * 1.5))));
  };

  const handlePointerUp = () => { dragging.current = false; };

  useEffect(() => {
    const el = knobRef.current;
    if (!el || !onChange) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onChange(Math.max(0, Math.min(100, value + (e.deltaY > 0 ? -5 : 5))));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [onChange, value]);

  const rotation = (value / 100) * 270 - 135;
  const numSegments = 24;
  const numRidges = 36;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[4.5rem] h-[4.5rem] lg:w-20 lg:h-20">
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
          {Array.from({ length: numSegments }).map((_, i) => {
            const segAngle = (i / numSegments) * 270 - 135;
            const segAngleEnd = ((i + 0.7) / numSegments) * 270 - 135;
            const rad1 = (segAngle * Math.PI) / 180;
            const rad2 = (segAngleEnd * Math.PI) / 180;
            const innerR = 38, outerR = 47;
            const isFilled = segAngle <= rotation;
            return (
              <polygon
                key={`seg-${i}`}
                points={`
                  ${50 + innerR * Math.sin(rad1)},${50 - innerR * Math.cos(rad1)}
                  ${50 + outerR * Math.sin(rad1)},${50 - outerR * Math.cos(rad1)}
                  ${50 + outerR * Math.sin(rad2)},${50 - outerR * Math.cos(rad2)}
                  ${50 + innerR * Math.sin(rad2)},${50 - innerR * Math.cos(rad2)}
                `}
                fill={isFilled ? "hsl(210,100%,50%)" : "hsl(0,0%,15%)"}
                opacity={isFilled ? 1 : 0.6}
              />
            );
          })}
          <text x="18" y="88" fill="hsl(0,0%,40%)" fontSize="5" fontFamily="monospace" textAnchor="middle">MIN</text>
          <text x="82" y="88" fill="hsl(0,0%,40%)" fontSize="5" fontFamily="monospace" textAnchor="middle">MAX</text>
        </svg>

        <div
          ref={knobRef}
          role={onChange ? "slider" : undefined}
          aria-label={ariaLabel || label || undefined}
          aria-valuemin={onChange ? 0 : undefined}
          aria-valuemax={onChange ? 100 : undefined}
          aria-valuenow={onChange ? value : undefined}
          tabIndex={onChange ? 0 : undefined}
          className="absolute inset-[22%] rounded-full flex items-center justify-center select-none"
          style={{
            cursor: onChange ? "grab" : "default",
            background: "radial-gradient(circle at 40% 35%, hsl(0,0%,20%) 0%, hsl(0,0%,10%) 60%, hsl(0,0%,6%) 100%)",
            boxShadow: "0 4px 14px hsl(0,0%,0%/0.9), 0 1px 3px hsl(0,0%,0%/0.5), inset 0 1px 0 hsl(0,0%,30%/0.15)",
            border: "1px solid hsl(0,0%,15%)",
          }}
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <svg className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none" viewBox="0 0 100 100">
            {Array.from({ length: numRidges }).map((_, i) => {
              const angle = (i / numRidges) * 360;
              const r = (angle * Math.PI) / 180;
              return (
                <line key={i}
                  x1={50 + 43 * Math.sin(r)} y1={50 - 43 * Math.cos(r)}
                  x2={50 + 50 * Math.sin(r)} y2={50 - 50 * Math.cos(r)}
                  stroke="hsl(0,0%,25%)" strokeWidth="1.2" />
              );
            })}
          </svg>
          <div className="absolute inset-[8%] rounded-full" style={{ border: "1px solid hsl(0,0%,20%)", background: "transparent" }} />
          <div
            className="absolute"
            style={{
              width: "2.5px", height: "40%", top: "6%", left: "50%",
              transformOrigin: "bottom center",
              transform: `translateX(-50%) rotate(${rotation}deg)`,
              background: "hsl(210,100%,50%)",
              boxShadow: "0 0 8px hsl(210,100%,50%/0.8), 0 0 3px hsl(210,100%,50%/0.5)",
              borderRadius: "1px",
            }}
          />
        </div>
      </div>
      <span style={{ fontSize: "10px", color: "hsl(0,0%,40%)", fontFamily: "monospace", letterSpacing: "0.25em", textTransform: "uppercase" }}>
        {label}
      </span>
    </div>
  );
}
