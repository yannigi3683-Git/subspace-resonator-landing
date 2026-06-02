export default function FloodlightSet() {
  return (
    <div aria-hidden="true">
      <style>{`
        @keyframes cabinet-pulse {
          0%, 100% { transform: scale(1.0); }
          50% { transform: scale(1.04); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cabinet-woofer { animation: none !important; }
        }
      `}</style>
      <div className="flex items-end gap-2 justify-center">
        {Array.from({ length: 4 }, (_, i) => (
          <svg
            key={i}
            data-cabinet
            width="60"
            height="80"
            viewBox="0 0 60 80"
          >
            {/* Cabinet body */}
            <rect
              x="2"
              y="2"
              width="56"
              height="76"
              rx="6"
              ry="6"
              fill="hsl(var(--muted))"
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
            />
            {/* Woofer circle */}
            <circle
              cx="30"
              cy="40"
              r="20"
              fill="hsl(var(--card))"
              stroke="hsl(var(--border))"
              strokeWidth="1"
              className="cabinet-woofer"
              style={{
                animation: 'cabinet-pulse 428ms ease-in-out infinite',
                transformOrigin: '30px 40px',
              }}
            />
            {/* Dust cap */}
            <circle cx="30" cy="40" r="6" fill="hsl(var(--muted))" />
          </svg>
        ))}
      </div>
    </div>
  );
}
