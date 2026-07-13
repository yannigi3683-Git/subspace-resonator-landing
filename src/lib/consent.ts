// Google Consent Mode v2 helper for the site's single analytics tracker (GA4).
// index.html sets the default consent state to 'denied' (cookieless) before GA
// loads; this module reads/writes the user's choice and upgrades GA to 'granted'
// when they accept in the cookie banner (CookieConsent.tsx).

export type ConsentValue = "granted" | "denied";

const STORAGE_KEY = "cookie-consent-v1";

export function getConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: ConsentValue): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // storage disabled (private mode) — the in-page choice still applies below
  }
  if (value === "granted") grantConsent();
}

// Upgrade GA to full (cookie-setting) analytics. No-ops when gtag is absent
// (tests, ad blockers) so callers never need to guard.
export function grantConsent(): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("consent", "update", { analytics_storage: "granted" });
}
