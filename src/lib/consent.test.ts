import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getConsent, setConsent, grantConsent } from './consent';

describe('consent', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).gtag;
  });

  it('getConsent returns null when unset', () => {
    expect(getConsent()).toBeNull();
  });

  it('setConsent("granted") persists and upgrades gtag', () => {
    const gtag = vi.fn();
    (window as any).gtag = gtag;
    setConsent('granted');
    expect(getConsent()).toBe('granted');
    expect(gtag).toHaveBeenCalledWith('consent', 'update', { analytics_storage: 'granted' });
  });

  it('setConsent("denied") persists and does not upgrade gtag', () => {
    const gtag = vi.fn();
    (window as any).gtag = gtag;
    setConsent('denied');
    expect(getConsent()).toBe('denied');
    expect(gtag).not.toHaveBeenCalled();
  });

  it('grantConsent no-ops safely when gtag is absent', () => {
    expect(() => grantConsent()).not.toThrow();
  });

  it('ignores an unrecognized stored value', () => {
    localStorage.setItem('cookie-consent-v1', 'maybe');
    expect(getConsent()).toBeNull();
  });
});
