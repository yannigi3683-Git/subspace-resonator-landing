import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CookieConsent from './CookieConsent';

describe('CookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).gtag;
  });

  it('shows the banner when consent is unset', () => {
    render(<CookieConsent />);
    expect(screen.getByRole('region', { name: /cookie consent/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy');
  });

  it('Accept stores granted, upgrades gtag, and hides the banner', () => {
    const gtag = vi.fn();
    (window as any).gtag = gtag;
    render(<CookieConsent />);
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(localStorage.getItem('cookie-consent-v1')).toBe('granted');
    expect(gtag).toHaveBeenCalledWith('consent', 'update', { analytics_storage: 'granted' });
    expect(screen.queryByRole('region', { name: /cookie consent/i })).toBeNull();
  });

  it('Decline stores denied, does not call gtag, and hides the banner', () => {
    const gtag = vi.fn();
    (window as any).gtag = gtag;
    render(<CookieConsent />);
    fireEvent.click(screen.getByRole('button', { name: /decline/i }));
    expect(localStorage.getItem('cookie-consent-v1')).toBe('denied');
    expect(gtag).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: /cookie consent/i })).toBeNull();
  });

  it('does not render when a choice already exists', () => {
    localStorage.setItem('cookie-consent-v1', 'denied');
    render(<CookieConsent />);
    expect(screen.queryByRole('region', { name: /cookie consent/i })).toBeNull();
  });
});
