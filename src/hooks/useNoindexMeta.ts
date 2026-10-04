import { useEffect } from 'react';

// While active, set <meta name="robots" content="noindex,nofollow"> so search
// engines don't index the page. Restore the prior content (or remove the meta
// entirely if we added it) on unmount.
export function useNoindexMeta(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;

    const head = document.head;
    let meta = head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousContent = meta?.getAttribute('content') ?? null;
    const createdHere = !meta;

    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex,nofollow');

    return () => {
      if (!meta) return;
      if (createdHere) {
        meta.parentNode?.removeChild(meta);
      } else if (previousContent !== null) {
        meta.setAttribute('content', previousContent);
      }
    };
  }, [active]);
}
