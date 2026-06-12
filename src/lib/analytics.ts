type GtagParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params?: GtagParams) => void;
  }
}

// Thin wrapper around the GA4 gtag.js global (loaded in index.html).
// No-ops when gtag is unavailable (SSR, tests, ad blockers) so callers never need to guard.
export function trackEvent(action: string, params?: GtagParams): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", action, params);
}
