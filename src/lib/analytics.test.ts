import { describe, it, expect, vi, afterEach } from "vitest";
import { trackEvent } from "./analytics";

afterEach(() => {
  delete window.gtag;
  vi.restoreAllMocks();
});

describe("trackEvent", () => {
  it("forwards the event name and params to window.gtag", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    trackEvent("social_click", { platform: "Spotify" });
    expect(gtag).toHaveBeenCalledWith("event", "social_click", { platform: "Spotify" });
  });

  it("is a safe no-op when gtag is not present", () => {
    delete window.gtag;
    expect(() => trackEvent("booking_click", { method: "email" })).not.toThrow();
  });
});
