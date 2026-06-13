import { ArrowUpRight } from "lucide-react";
import { trackEvent } from "../lib/analytics";

type Release = {
  date: string;
  title: string;
  meta: string;
  url?: string;
};

const SOLO_RELEASES: Release[] = [
  {
    date: "2025.12.26",
    title: "The Subspace Theory",
    meta: "EP · 4 Tracks · Goa Records",
    url: "https://yannig.bandcamp.com/album/the-subspace-theory-ep",
  },
  {
    date: "2025.10.31",
    title: "Nightmare In Heaven",
    meta: "Single · Timewarp Records",
    url: "https://yannig.bandcamp.com/track/nightmare-in-heaven",
  },
  {
    date: "2025",
    title: "Galaxy 604",
    meta: "Single · Goa Records",
    url: "https://yannig.bandcamp.com/track/galaxy-604-goaep604-goa-records",
  },
];

const COMPILATION_APPEARANCES: Release[] = [
  {
    date: "2026.01.09",
    title: "Psychedelic Goa Trance 2026: 100 Aliens",
    meta: '"Galaxy 604" · Fresh Frequencies',
    url: "https://freshfrequencies.bandcamp.com/album/psychedelic-goa-trance-2026-100-aliens",
  },
  {
    date: "2026",
    title: "The Call Of Goa, Vol. 5",
    meta: '"Subspace Disturbance" · Timewarp Records',
    url: "https://timewarprecords.bandcamp.com/album/the-call-of-goa-vol-5",
  },
  {
    date: "2026",
    title: "Psy Trance 2026: Space DJ",
    meta: '"Galaxy 604" · Fresh Frequencies',
    url: "https://open.spotify.com/album/73EV8DxuOgSoAhqSXSYhwn?si=NOD-pJajTYKP-Yr6trlgqg",
  },
];

const ROW_GRID =
  "grid grid-cols-[5rem_1fr_auto] sm:grid-cols-[6.5rem_1fr_auto] gap-x-3 sm:gap-x-5 py-3 border-b border-border/40 font-mono";

const RowBody = ({ r }: { r: Release }) => (
  <>
    <span className="text-primary text-[11px] sm:text-xs pt-px tabular-nums">{r.date}</span>
    <div className="min-w-0">
      <div className="text-foreground group-hover:text-primary transition-colors text-xs sm:text-sm uppercase tracking-[0.12em]">
        {r.title}
      </div>
      <div className="text-muted-foreground text-[11px] sm:text-xs mt-1">{r.meta}</div>
    </div>
  </>
);

const LogRow = ({ r }: { r: Release }) => {
  if (!r.url) {
    return (
      <div className={ROW_GRID}>
        <RowBody r={r} />
        <span aria-hidden className="w-4" />
      </div>
    );
  }

  return (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${r.title}, open release`}
      onClick={() => trackEvent("release_click", { title: r.title })}
      className={`group ${ROW_GRID} items-center outline-none focus-visible:ring-1 focus-visible:ring-primary/60 rounded-sm`}
    >
      <RowBody r={r} />
      <ArrowUpRight
        aria-hidden
        className="w-4 h-4 self-center text-primary opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 transition"
      />
    </a>
  );
};

const LogGroup = ({ label, rows }: { label: string; rows: Release[] }) => (
  <div>
    <p className="text-[11px] tracking-[0.25em] text-muted-foreground/70 mb-3 font-mono uppercase">
      {label}
    </p>
    <div>
      {rows.map((r) => (
        <LogRow key={r.title} r={r} />
      ))}
    </div>
  </div>
);

type SignalLogProps = {
  rows?: { solo: Release[]; comps: Release[] };
};

const SignalLog = ({ rows }: SignalLogProps = {}) => {
  const solo = rows?.solo ?? SOLO_RELEASES;
  const comps = rows?.comps ?? COMPILATION_APPEARANCES;
  return (
    <section id="archive" aria-label="Discography" className="py-10 md:py-16 border-t border-border">
      <div className="container">
        <h2 className="text-sm tracking-[0.3em] text-primary mb-8 uppercase font-mono">
          // MUSIC ARCHIVE
        </h2>
        <div className="space-y-10">
          <LogGroup label="Solo Releases" rows={solo} />
          <LogGroup label="Compilation Appearances" rows={comps} />
        </div>
      </div>
    </section>
  );
};

export default SignalLog;