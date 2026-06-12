type Release = {
  date: string;
  title: string;
  meta: string;
};

const SOLO_RELEASES: Release[] = [
  { date: "2025.12.26", title: "The Subspace Theory", meta: "EP · 4 Tracks · Independent" },
  { date: "2025.10.31", title: "Nightmare In Heaven", meta: "Single · Timewarp Records" },
  { date: "2025", title: "Galaxy 604", meta: "Single · Goa Records" },
];

const COMPILATION_APPEARANCES: Release[] = [
  { date: "2026.01.09", title: "Psychedelic Goa Trance 2026: 100 Aliens", meta: '"Galaxy 604" · Fresh Frequencies' },
  { date: "2026", title: "The Call Of Goa, Vol. 5", meta: '"Subspace Disturbance" · Timewarp Records' },
  { date: "2026", title: "Psy Trance 2026: Space DJ", meta: '"Galaxy 604" · Fresh Frequencies' },
];

const LogGroup = ({ label, rows }: { label: string; rows: Release[] }) => (
  <div>
    <p className="text-[11px] tracking-[0.25em] text-muted-foreground/70 mb-3 font-mono uppercase">
      {label}
    </p>
    <div>
      {rows.map((r) => (
        <div
          key={r.title}
          className="grid grid-cols-[5rem_1fr] sm:grid-cols-[6.5rem_1fr] gap-x-3 sm:gap-x-5 py-3 border-b border-border/40 font-mono"
        >
          <span className="text-primary text-[11px] sm:text-xs pt-px tabular-nums">{r.date}</span>
          <div className="min-w-0">
            <div className="text-foreground text-xs sm:text-sm uppercase tracking-[0.12em]">
              {r.title}
            </div>
            <div className="text-muted-foreground text-[11px] sm:text-xs mt-1">{r.meta}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const SignalLog = () => {
  return (
    <section id="archive" aria-label="Discography" className="py-10 md:py-16 border-t border-border">
      <div className="container">
        <h2 className="text-sm tracking-[0.3em] text-primary mb-8 uppercase font-mono">
          // MUSIC ARCHIVE
        </h2>
        <div className="space-y-10">
          <LogGroup label="Solo Releases" rows={SOLO_RELEASES} />
          <LogGroup label="Compilation Appearances" rows={COMPILATION_APPEARANCES} />
        </div>
      </div>
    </section>
  );
};

export default SignalLog;
