import type { BreadcrumbItemType } from '@/components/PageBreadcrumb';

/**
 * Schema.org BreadcrumbList JSON-LD payload.
 * Search engines use this to render breadcrumb-style result links instead
 * of raw URLs. See https://schema.org/BreadcrumbList.
 *
 * Position 1 is the Home crumb (auto-prepended by the renderer); the
 * `crumbs` array is the trail AFTER Home — exactly what GlobalLayout
 * receives as the `breadcrumbs` prop.
 *
 * `currentPath` is the URL of the current page; we pass it explicitly so
 * the JSON-LD includes a final ListItem for the page the user is actually on
 * (the visible breadcrumb's last item has no `path` field, but search
 * engines still want a URL there).
 */

export interface BreadcrumbListJsonLd {
  '@context': 'https://schema.org';
  '@type': 'BreadcrumbList';
  itemListElement: Array<{
    '@type': 'ListItem';
    position: number;
    name: string;
    item: string;
  }>;
}

export interface BuildJsonLdInput {
  /** Items as passed to PageBreadcrumb (the trail AFTER Home). */
  crumbs: BreadcrumbItemType[];
  /** Origin (e.g. 'https://bachatacalendar.co.uk'). Used to make absolute URLs. */
  origin: string;
  /** The current page's full URL (origin + path). Used for the final crumb's
   *  `item` field — the visible breadcrumb omits `path` for the current page,
   *  but search engines still want an absolute URL there. */
  currentUrl: string;
  /** Label for the auto-prepended Home crumb. Defaults to 'Home'. */
  homeLabel?: string;
}

export function buildBreadcrumbListJsonLd(input: BuildJsonLdInput): BreadcrumbListJsonLd {
  const { crumbs, origin, currentUrl, homeLabel = 'Home' } = input;
  const itemListElement: BreadcrumbListJsonLd['itemListElement'] = [];

  // Position 1 — Home (always present, always the origin).
  itemListElement.push({
    '@type': 'ListItem',
    position: 1,
    name: homeLabel,
    item: origin || '/',
  });

  for (let i = 0; i < crumbs.length; i++) {
    const crumb = crumbs[i];
    const isLast = i === crumbs.length - 1;
    // For intermediate crumbs we use crumb.path; for the last (current page)
    // we use the explicit currentUrl since the visible breadcrumb omits path.
    const path = isLast ? currentUrl : crumb.path;
    if (!path) continue; // skip crumbs we can't address (very rare)
    itemListElement.push({
      '@type': 'ListItem',
      position: itemListElement.length + 1,
      name: crumb.label,
      item: path.startsWith('http') ? path : `${origin}${path.startsWith('/') ? '' : '/'}${path}`,
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement,
  };
}

/** Render the JSON-LD payload as a string suitable for a <script> tag. */
export function renderBreadcrumbListJsonLd(input: BuildJsonLdInput): string {
  return JSON.stringify(buildBreadcrumbListJsonLd(input));
}
