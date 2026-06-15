import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: { sitekey: string; callback: (token: string) => void; size: string },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
}

export function TurnstileWidget({ onToken }: TurnstileWidgetProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    if (import.meta.env.VITEST === 'true') {
      onTokenRef.current('test-token');
      return;
    }

    const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string;
    if (!sitekey || !divRef.current) return;

    const render = () => {
      if (!divRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(divRef.current, {
        sitekey,
        callback: (token) => onTokenRef.current(token),
        size: 'invisible',
      });
    };

    if (window.turnstile) {
      render();
    } else if (!document.querySelector('script[data-turnstile]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.dataset.turnstile = '1';
      script.onload = render;
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
  return <div ref={divRef} />;
}
