import { useState } from "react";
import { getConsent, setConsent, type ConsentValue } from "../lib/consent";

// Non-blocking bottom banner. GA already loads in a denied/cookieless state
// (index.html Consent Mode default); this only records the user's choice and,
// on Accept, upgrades GA to set analytics cookies. Page stays fully usable while shown.
export default function CookieConsent() {
  const [visible, setVisible] = useState(() => getConsent() === null);
  if (!visible) return null;

  const choose = (v: ConsentValue) => {
    setConsent(v);
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className="fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px))] md:bottom-0 inset-x-0 z-50 glass-header border-t border-border"
    >
      <div className="container py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="flex-1 text-[11px] leading-relaxed text-muted-foreground tracking-[0.1em]">
          This site uses cookies for anonymous analytics (Google Analytics). No analytics cookies are set until you accept. Read our{" "}
          <a href="/privacy" className="text-primary hover:underline">privacy policy</a>.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => choose("denied")}
            className="min-h-[44px] px-4 border border-border hover:border-primary hover:text-primary transition-colors text-[10px] tracking-[0.25em] uppercase"
          >
            Decline
          </button>
          <button
            onClick={() => choose("granted")}
            className="min-h-[44px] px-4 border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-[10px] tracking-[0.25em] uppercase"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
