/**
 * Per-page SEO primitive. Call useSeo() with buildSeoForRoute(routeId, ctx)
 * - same call-site shape as buildBreadcrumbs. Sets baseline on unmount so
 * stale meta does not bleed into the next route.
 */

import { useEffect, useRef } from 'react';

const SITE_NAME = 'Bachata Calendar';
const SITE_ORIGIN = 'https://bachatacalendar.co.uk';
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/og-image.jpg`;

// Tab title scroll: shift one char per tick; separator pads the gap between repeats
const SCROLL_INTERVAL_MS = 200;
const SCROLL_SEPARATOR = '     ';

export interface SeoInput {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
}

function ensureMeta(selector: string, factory: () => HTMLMetaElement): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) { el = factory(); document.head.appendChild(el); }
  return el;
}

function ensureLink(rel: string): HTMLLinkElement {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
  return el;
}

function setName(name: string, content: string) {
  const el = ensureMeta(`meta[name="${name}"]`, () => {
    const m = document.createElement('meta'); m.name = name; return m;
  });
  el.setAttribute('content', content);
}

function setProp(property: string, content: string) {
  const el = ensureMeta(`meta[property="${property}"]`, () => {
    const m = document.createElement('meta'); m.setAttribute('property', property); return m;
  });
  el.setAttribute('content', content);
}

function withSuffix(t: string): string {
  return t.includes(SITE_NAME) ? t : `${t} | ${SITE_NAME}`;
}

function startTitleScroll(title: string): () => void {
  const scrollStr = title + SCROLL_SEPARATOR;
  let pos = 0;
  const id = setInterval(() => {
    document.title = scrollStr.slice(pos) + scrollStr.slice(0, pos);
    pos = (pos + 1) % scrollStr.length;
  }, SCROLL_INTERVAL_MS);
  return () => clearInterval(id);
}

// The prerender step (scripts/prerender.mjs) and search crawlers snapshot the
// DOM; if the animated scroll is running, the snapshot captures a scrambled
// mid-scroll <title>. Skip the animation for headless/bot contexts so the
// clean title (set above) is what gets indexed. Live human tabs still scroll.
function isHeadlessOrPrerender(): boolean {
  if (typeof navigator === 'undefined') return true;
  if (navigator.webdriver) return true; // Playwright / Puppeteer prerender
  return /prerender|headless|bot|crawler|spider/i.test(navigator.userAgent || '');
}

export function useSeo(input: SeoInput | null | undefined) {
  const baseline = useRef<{ title: string; description: string; canonical: string } | null>(null);

  useEffect(() => {
    if (!input || typeof document === 'undefined') return;

    if (!baseline.current) {
      const d = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
      const c = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      baseline.current = {
        title: document.title,
        description: d?.getAttribute('content') ?? '',
        canonical: c?.getAttribute('href') ?? SITE_ORIGIN,
      };
    }

    const title = withSuffix(input.title);
    const description = input.description;
    const canonical = input.canonical ?? SITE_ORIGIN;
    const ogImage = input.ogImage ?? DEFAULT_OG_IMAGE;
    const ogType = input.ogType ?? 'website';

    document.title = title;
    setName('description', description);
    ensureLink('canonical').href = canonical;

    setProp('og:title', title);
    setProp('og:description', description);
    setProp('og:url', canonical);
    setProp('og:image', ogImage);
    // Declare dimensions only for the default card (known 1200x630 JPEG). Per-
    // page covers have unknown size/type, so we don't assert dimensions there
    // — and bots get the normalized card via middleware anyway.
    if (ogImage === DEFAULT_OG_IMAGE) {
      setProp('og:image:width', '1200');
      setProp('og:image:height', '630');
      setProp('og:image:type', 'image/jpeg');
    }
    setProp('og:type', ogType);

    setName('twitter:title', title);
    setName('twitter:description', description);
    setName('twitter:image', ogImage);

    if (input.noindex) {
      setName('robots', 'noindex,nofollow');
    } else {
      document.head.querySelector('meta[name="robots"]')?.remove();
    }

    const stopScroll = isHeadlessOrPrerender() ? () => {} : startTitleScroll(title);

    return () => {
      stopScroll();
      const b = baseline.current;
      if (!b) return;
      document.title = b.title;
      setName('description', b.description);
      ensureLink('canonical').href = b.canonical;
      document.head.querySelector('meta[name="robots"]')?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: re-running on every new `input` object reference (most pages pass a fresh literal) would thrash document.head on every render. The field-level deps below are the actual change drivers.
  }, [input?.title, input?.description, input?.canonical, input?.ogImage, input?.ogType, input?.noindex]);
}

export { SITE_NAME, SITE_ORIGIN, DEFAULT_OG_IMAGE };
