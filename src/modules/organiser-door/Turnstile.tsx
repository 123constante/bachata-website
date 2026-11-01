// Cloudflare Turnstile slot. Renders NOTHING (and loads no script) without a site key.
import { useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
type TurnstileApi = { render(el: HTMLElement, opts: Record<string, unknown>): string; remove(id: string): void };
const api = (): TurnstileApi | undefined => (window as unknown as { turnstile?: TurnstileApi }).turnstile;

function loadScript(): Promise<void> {
  if (api()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const el = existing ?? Object.assign(document.createElement('script'), { src: SCRIPT_SRC, async: true });
    el.addEventListener('load', () => resolve());
    el.addEventListener('error', () => reject(new Error('turnstile script')));
    if (!existing) document.head.appendChild(el);
  });
}

export function Turnstile({ siteKey, onToken }: { siteKey: string | null; onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!siteKey) return;
    let id: string | undefined;
    let gone = false;
    void loadScript().then(() => {
      if (gone || !box.current || !api()) return;
      id = api()!.render(box.current, {
        sitekey: siteKey,
        callback: (t: string) => onToken(t),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      });
    }).catch(() => onToken(null));
    return () => { gone = true; if (id && api()) api()!.remove(id); };
  }, [siteKey, onToken]);
  if (!siteKey) return null;
  return <div ref={box} className="min-h-[65px]" data-testid="door-turnstile" />;
}
