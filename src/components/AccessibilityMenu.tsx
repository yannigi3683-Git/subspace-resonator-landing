import { useState, useEffect, useCallback } from "react";
import { Accessibility, X, RotateCcw, Type, Contrast, Eye, MousePointer2, Link2, Pause, ImageOff, FileText } from "lucide-react";

type Settings = {
  fontScale: number;
  lineHeight: number;
  letterSpacing: number;
  contrast: "default" | "high" | "inverted" | "monochrome";
  highlightLinks: boolean;
  bigCursor: boolean;
  pauseAnimations: boolean;
  hideImages: boolean;
  readableFont: boolean;
};

const DEFAULTS: Settings = {
  fontScale: 1,
  lineHeight: 1,
  letterSpacing: 0,
  contrast: "default",
  highlightLinks: false,
  bigCursor: false,
  pauseAnimations: false,
  hideImages: false,
  readableFont: false,
};

const STORAGE_KEY = "a11y-settings-v1";

const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
};

const applySettings = (s: Settings) => {
  const root = document.documentElement;
  root.style.setProperty("--a11y-font-scale", String(s.fontScale));
  root.style.setProperty("--a11y-line-height", String(s.lineHeight));
  root.style.setProperty("--a11y-letter-spacing", `${s.letterSpacing}em`);
  root.classList.toggle("a11y-contrast-high", s.contrast === "high");
  root.classList.toggle("a11y-contrast-inverted", s.contrast === "inverted");
  root.classList.toggle("a11y-contrast-mono", s.contrast === "monochrome");
  root.classList.toggle("a11y-highlight-links", s.highlightLinks);
  root.classList.toggle("a11y-big-cursor", s.bigCursor);
  root.classList.toggle("a11y-pause-anim", s.pauseAnimations);
  root.classList.toggle("a11y-hide-images", s.hideImages);
  root.classList.toggle("a11y-readable-font", s.readableFont);
  root.classList.toggle("a11y-font-scaled", s.fontScale !== 1);
  root.classList.toggle("a11y-line-scaled", s.lineHeight !== 1);
  root.classList.toggle("a11y-letter-scaled", s.letterSpacing !== 0);
};

const AccessibilityMenu = () => {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    const loaded = loadSettings();
    setSettings(loaded);
    applySettings(loaded);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      applySettings(next);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    applySettings(DEFAULTS);
    setSettings(DEFAULTS);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open accessibility menu (Alt+A)"
        aria-expanded={open}
        aria-controls="a11y-panel"
        className="fixed left-2 z-[60] w-9 h-9 md:w-12 md:h-12 flex items-center justify-center border border-border bg-background text-primary hover:bg-secondary hover:border-primary transition-colors bottom-[calc(env(safe-area-inset-bottom,0px)+10.5rem)] md:bottom-3"
        style={{ boxShadow: "0 0 12px hsl(210 100% 50% / 0.3)" }}
      >
        <Accessibility size={16} className="md:w-[22px] md:h-[22px]" aria-hidden="true" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] bg-background/70"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id="a11y-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="a11y-title"
        className={`fixed top-0 left-0 bottom-0 z-[71] w-[88vw] max-w-[360px] bg-card border-r border-border overflow-y-auto transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
          <h2 id="a11y-title" className="text-xs tracking-[0.3em] text-primary uppercase">
            // ACCESSIBILITY
          </h2>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close accessibility menu"
            className="w-10 h-10 flex items-center justify-center border border-border hover:border-primary hover:text-primary transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <Section icon={<Type size={14} aria-hidden="true" />} title="TEXT SIZE">
            <SegmentedControl
              value={settings.fontScale}
              options={[
                { value: 1, label: "A" },
                { value: 1.15, label: "A+" },
                { value: 1.3, label: "A++" },
                { value: 1.5, label: "A+++" },
                { value: 1.75, label: "MAX" },
              ]}
              onChange={(v) => update({ fontScale: v })}
              ariaLabel="Text size"
            />
          </Section>

          <Section icon={<FileText size={14} aria-hidden="true" />} title="LINE SPACING">
            <SegmentedControl
              value={settings.lineHeight}
              options={[
                { value: 1, label: "DEFAULT" },
                { value: 1.5, label: "1.5X" },
                { value: 2, label: "2X" },
              ]}
              onChange={(v) => update({ lineHeight: v })}
              ariaLabel="Line spacing"
            />
          </Section>

          <Section icon={<FileText size={14} aria-hidden="true" />} title="LETTER SPACING">
            <SegmentedControl
              value={settings.letterSpacing}
              options={[
                { value: 0, label: "DEFAULT" },
                { value: 0.05, label: "WIDE" },
                { value: 0.1, label: "WIDER" },
              ]}
              onChange={(v) => update({ letterSpacing: v })}
              ariaLabel="Letter spacing"
            />
          </Section>

          <Section icon={<Contrast size={14} aria-hidden="true" />} title="CONTRAST">
            <SegmentedControl
              value={settings.contrast}
              options={[
                { value: "default", label: "DEFAULT" },
                { value: "high", label: "HIGH" },
                { value: "inverted", label: "INVERT" },
                { value: "monochrome", label: "MONO" },
              ]}
              onChange={(v) => update({ contrast: v as Settings["contrast"] })}
              ariaLabel="Contrast mode"
            />
          </Section>

          <Section icon={<Eye size={14} aria-hidden="true" />} title="VISIBILITY & MOTION">
            <Toggle icon={<Link2 size={14} aria-hidden="true" />} label="Highlight links" value={settings.highlightLinks} onChange={(v) => update({ highlightLinks: v })} />
            <Toggle icon={<MousePointer2 size={14} aria-hidden="true" />} label="Big cursor" value={settings.bigCursor} onChange={(v) => update({ bigCursor: v })} />
            <Toggle icon={<Pause size={14} aria-hidden="true" />} label="Pause animations" value={settings.pauseAnimations} onChange={(v) => update({ pauseAnimations: v })} />
            <Toggle icon={<ImageOff size={14} aria-hidden="true" />} label="Hide images" value={settings.hideImages} onChange={(v) => update({ hideImages: v })} />
            <Toggle icon={<Type size={14} aria-hidden="true" />} label="Readable font" value={settings.readableFont} onChange={(v) => update({ readableFont: v })} />
          </Section>

          <button
            onClick={reset}
            className="w-full flex items-center justify-center gap-2 p-3 border border-border hover:border-primary hover:text-primary transition-colors text-[10px] tracking-[0.25em] uppercase min-h-[44px]"
          >
            <RotateCcw size={14} aria-hidden="true" />
            RESET ALL
          </button>

          <div className="pt-4 border-t border-border space-y-2 text-[10px] text-muted-foreground tracking-[0.15em] leading-relaxed">
            <p className="uppercase text-foreground">// ACCESSIBILITY STATEMENT</p>
            <p>We strive to comply with WCAG 2.1 Level AA. If you encounter any barrier on this site, please contact us so we can help and improve.</p>
            <p>Email: <a href="mailto:subspaceresonator@gmail.com" className="text-primary hover:underline">subspaceresonator@gmail.com</a></p>
            <p>Phone: <a href="tel:+972507974184" className="text-primary hover:underline">+972-50-7974184</a></p>
            <p className="pt-2">Shortcut: <span className="text-foreground">Alt + A</span></p>
          </div>
        </div>
      </aside>
    </>
  );
};

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div>
    <div className="flex items-center gap-2 mb-2 text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
      {icon}<span>{title}</span>
    </div>
    <div className="space-y-1">{children}</div>
  </div>
);

type Opt<T> = { value: T; label: string };

function SegmentedControl<T extends string | number>({ value, options, onChange, ariaLabel }: { value: T; options: Opt<T>[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex border border-border">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button key={String(opt.value)} role="radio" aria-checked={active} onClick={() => onChange(opt.value)}
            className={`flex-1 px-2 py-2 text-[10px] tracking-[0.15em] uppercase border-r border-border last:border-r-0 transition-colors min-h-[40px] ${
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary hover:bg-secondary"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const Toggle = ({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <button role="switch" aria-checked={value} onClick={() => onChange(!value)}
    className="w-full flex items-center justify-between gap-3 p-2 border border-border hover:border-primary transition-colors min-h-[44px]"
  >
    <span className="flex items-center gap-2 text-xs">{icon}{label}</span>
    <span className={`w-10 h-5 border border-border relative transition-colors ${value ? "bg-primary" : "bg-background"}`} aria-hidden="true">
      <span className="absolute top-[2px] w-3 h-3 border border-border transition-all"
        style={{ left: value ? "22px" : "2px", background: value ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))" }}
      />
    </span>
  </button>
);

export default AccessibilityMenu;
