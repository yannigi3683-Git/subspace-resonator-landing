import { useEffect, useRef } from 'react';

interface TurnstileRenderOpts {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback'?: (code?: string) => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: TurnstileRenderOpts) => string;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onError?: (message: string) => void;
}

export function TurnstileWidget({ onToken, onError }: TurnstileWidgetProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  onTokenRef.current = onToken;
  onErrorRef.current = onError;

  useEffect(() => {
    if (import.meta.env.VITEST === 'true') {
      onTokenRef.current('test-token');
      return;
    }

    // Strip BOM/non-ASCII that PowerShell UTF-16 encoding may prepend to env vars. An
    // invisible char makes turnstile.render() throw "Invalid input for parameter sitekey".
    const rawKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '';
    let sitekey = '';
    for (let i = 0; i < rawKey.length; i++) {
      const code = rawKey.charCodeAt(i);
      if (code >= 0x20 && code <= 0x7e) sitekey += rawKey[i];
    }
    sitekey = sitekey.trim();

    if (!divRef.current) return;
    if (!sitekey) {
      onErrorRef.current?.('Captcha is not configured (no site key). Check VITE_TURNSTILE_SITE_KEY.');
      return;
    }

    const render = () => {
      if (!divRef.current || !window.turnstile) return;
      // A managed (visible) widget runs automatically on render and fires `callback`.
      // Wrap render so an invalid key fails quietly instead of crashing the whole app.
      try {
        widgetIdRef.current = window.turnstile.render(divRef.current, {
          sitekey,
          theme: 'dark',
          callback: (token) => onTokenRef.current(token),
          'error-callback': () => {
            onErrorRef.current?.(
              'Captcha failed to load. This web address may not be on the captcha allowed-domains list.',
            );
          },
          'expired-callback': () => onTokenRef.current(''),
        });
      } catch (e) {
        onErrorRef.current?.('Captcha could not start: ' + (e instanceof Error ? e.message : String(e)));
      }
    };

    if (window.turnstile) {
      render();
    } else if (!document.querySelector('script[data-turnstile]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.dataset.turnstile = '1';
      script.onload = render;
      script.onerror = () =>
        onErrorRef.current?.('Could not reach the captcha service. Check your connection or ad blocker.');
      document.head.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          render();
        }
      }, 100);
      return () => clearInterval(interval);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  if (import.meta.env.VITEST === 'true') return null;
  return <div ref={divRef} className="my-1" />;
}
