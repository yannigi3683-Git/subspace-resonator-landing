interface HybridVisualizerProps {
  size?: number;
}

const RING_COLORS = ['#B15CFF', '#FF4FC3', '#26C6DA', '#7CFF6B', '#FFD700'];

function ringEllipses(cx: number, cy: number, rx: number, ry: number, steps: number, color: string, width: number) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    out.push(
      <ellipse
        key={`${color}-${i}`}
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        transform={`rotate(${(180 / steps) * i} ${cx} ${cy})`}
        stroke={color}
        strokeWidth={width}
        fill="none"
      />,
    );
  }
  return out;
}

function dotRing(cx: number, cy: number, r: number, count: number) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (2 * Math.PI * i) / count;
    out.push(
      <circle
        key={i}
        cx={cx + r * Math.cos(a)}
        cy={cy + r * Math.sin(a)}
        r={2}
        fill={i % 2 === 0 ? '#26C6DA' : '#FFD700'}
      />,
    );
  }
  return out;
}

// Small flower visualizer that sits behind the DJ. Static SVG, rotated by a CSS-only animation
// (radio-hybrid-spin, compositor thread): no AudioContext, no per-frame JS, so it cannot touch
// the audio path.
export function HybridVisualizer({ size = 176 }: HybridVisualizerProps) {
  const c = 150;
  return (
    <div
      className="radio-hybrid-spin pointer-events-none"
      style={{ width: size, height: size }}
      aria-hidden="true"
      data-testid="hybrid-viz"
    >
      <svg viewBox="0 0 300 300" width={size} height={size}>
        {ringEllipses(c, c, 146, 58, 12, RING_COLORS[0], 1.1)}
        {ringEllipses(c, c, 118, 40, 12, RING_COLORS[1], 1.1)}
        {ringEllipses(c, c, 92, 46, 10, RING_COLORS[2], 1.1)}
        {ringEllipses(c, c, 66, 22, 10, RING_COLORS[3], 1.1)}
        {ringEllipses(c, c, 40, 18, 8, RING_COLORS[4], 1.4)}
        {dotRing(c, c, 148, 24)}
        <circle cx={c} cy={c} r={10} fill="#FFFFFF" />
      </svg>
    </div>
  );
}
