import { useCallback, useRef } from 'react';

interface KnobProps {
  value: number;
  onChange: (v: number) => void;
  label?: string;
}

export default function Knob({ value, onChange, label = 'Volume' }: KnobProps) {
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const clamp = useCallback((v: number) => Math.max(0, Math.min(100, v)), []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); onChange(clamp(value + 5)); }
      if (e.key === 'ArrowDown') { e.preventDefault(); onChange(clamp(value - 5)); }
    },
    [value, onChange, clamp],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      onChange(clamp(value + (e.deltaY < 0 ? 5 : -5)));
    },
    [value, onChange, clamp],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      startY.current = e.clientY;
      startValue.current = value;

      function onMove(ev: MouseEvent) {
        if (!isDragging.current) return;
        const delta = (startY.current - ev.clientY) * 0.5;
        onChange(clamp(startValue.current + delta));
      }
      function onUp() {
        isDragging.current = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [value, onChange, clamp],
  );

  const rotation = -135 + (value / 100) * 270;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        className="w-10 h-10 rounded-full border-2 border-border bg-card cursor-pointer relative focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background flex items-center justify-center"
        style={{ userSelect: 'none' }}
        onKeyDown={handleKeyDown}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        <div
          className="w-1 h-3 bg-primary absolute top-1 left-1/2"
          style={{
            transform: `translateX(-50%) rotate(${rotation}deg)`,
            transformOrigin: 'bottom center',
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground font-mono">{label.toUpperCase()}</p>
    </div>
  );
}
