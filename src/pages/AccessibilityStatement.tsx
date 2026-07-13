import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

const LAST_REVIEWED = "13 July 2026";

export default function AccessibilityStatement() {
  useEffect(() => {
    document.title = "Accessibility Statement | Subspace Resonator";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container max-w-3xl py-16 md:py-24">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase text-muted-foreground hover:text-primary transition-colors mb-10"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to site
        </a>

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Accessibility Statement</h1>
        <p className="text-[11px] text-muted-foreground tracking-[0.2em] uppercase mb-10">
          Last reviewed: {LAST_REVIEWED}
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <p>
              Subspace Resonator is committed to making subspaceresonator.com usable
              for as many people as possible, including people who use assistive
              technology. We aim to conform to WCAG 2.1 Level AA and the Israeli
              Standard IS 5568.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">What we have done</h2>
            <ul className="space-y-2 list-disc pl-5">
              <li>An on-site accessibility menu (open it with the button on the left edge, or press Alt + A) with text sizing, line and letter spacing, high contrast, invert and monochrome modes, link highlighting, a large cursor, an option to pause animations, an option to hide images, and a readable font.</li>
              <li>A skip-to-content link for keyboard users.</li>
              <li>Text alternatives on meaningful images.</li>
              <li>Keyboard support for interactive controls, including the music player.</li>
              <li>Semantic structure and ARIA labels for screen readers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Known limitations</h2>
            <p>
              The site embeds third-party players (such as SoundCloud) whose internal
              accessibility we do not control. We keep working to improve coverage. If
              something does not work for you, please tell us using the contact below
              and we will help and fix it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Accessibility coordinator</h2>
            <p>If you find a barrier on this site, or need content in another form, contact:</p>
            <ul className="mt-3 space-y-1">
              <li>Name: Yanni (Subspace Resonator)</li>
              <li>
                Email:{" "}
                <a href="mailto:subspaceresonator@gmail.com" className="text-primary hover:underline">
                  subspaceresonator@gmail.com
                </a>
              </li>
              <li>
                Phone:{" "}
                <a href="tel:+972507974184" className="text-primary hover:underline">
                  +972-50-7974184
                </a>
              </li>
            </ul>
            <p className="mt-3">
              We aim to respond within a few business days.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
