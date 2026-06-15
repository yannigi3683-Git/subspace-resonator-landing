import { ArrowUpRight } from "lucide-react";
import { trackEvent } from "../lib/analytics";
import { useReleases, sortReleasesByDate } from "../lib/siteContent";
import type { Release } from "../lib/siteContent";

function displayDate(d: string): string {
  // Full date YYYY-MM-DD → DD.MM.YYYY (EU style); year-only stays as-is
  const full = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) return `${full[3]}.${full[2]}.${full[1]}`;
  return d;
}

function buildMeta(r: Release): string {
  if (r.kind === 'Compilation') {
    return r.trackName ? `"${r.trackName}" · ${r.label}` : r.label;
  }
  if (r.kind === 'EP') {
    return r.trackCount ? `EP · ${r.trackCount} Tracks · ${r.label}` : `EP · ${r.label}`;
  }
  if (r.kind === 'LP') {
    return r.trackCount ? `LP · ${r.trackCount} Tracks · ${r.label}` : `LP · ${r.label}`;
  }
  if (r.kind === 'Remix') {
    return `Remix · ${r.label}`;
  }
  return `Single · ${r.label}`;
}

const ROW_GRID =
  "grid grid-cols-[5rem_1fr_auto] sm:grid-cols-[6.5rem_1fr_auto] gap-x-3 sm:gap-x-5 py-3 border-b border-border/40 font-mono";

const RowBody = ({ r }: { r: Release }) => (
  <>
    <span className="text-primary text-[11px] sm:text-xs pt-px tabular-nums">{displayDate(r.date)}</span>
    <div className="min-w-0">
      <div className="text-foreground group-hover:text-primary transition-colors text-xs sm:text-sm uppercase tracking-[0.12em]">
        {r.title}
      </div>
      <div className="text-muted-foreground text-[11px] sm:text-xs mt-1">{buildMeta(r)}</div>
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
        <LogRow key={r.id} r={r} />
      ))}
    </div>
  </div>
);

type SignalLogProps = {
  rows?: { solo: Release[]; comps: Release[] };
};

const SignalLog = ({ rows }: SignalLogProps = {}) => {
  const releases = useReleases();
  const solo = sortReleasesByDate(rows?.solo ?? releases.solo);
  const comps = sortReleasesByDate(rows?.comps ?? releases.compilations);
  return (
    <section id="archive" aria-label="Discography" className="py-10 md:py-16 border-t border-border">
      <div className="container">
        <h2 className="text-sm tracking-[0.3em] text-primary mb-8 uppercase font-mono">
          // MUSIC ARCHIVE
        </h2>
        <div className="space-y-10">
          <LogGroup label="Releases" rows={solo} />
          <LogGroup label="Compilation Appearances" rows={comps} />
        </div>
      </div>
    </section>
  );
};

export default SignalLog;
