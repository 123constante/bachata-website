/**
 * Schema.org WebSite + SearchAction JSON-LD.
 *
 * Renders the sitelinks search box in Google SERPs by declaring that
 * /search?q={query} accepts a search-action URL template.
 * Emit once, on the homepage only.
 *
 * https://developers.google.com/search/docs/appearance/structured-data/sitelinks-searchbox
 */

import { SITE_NAME, SITE_ORIGIN } from './seo';

export function buildWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: 'Bachata Calendar UK',
    url: SITE_ORIGIN,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_ORIGIN}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function renderWebsiteJsonLd(): string {
  return JSON.stringify(buildWebsiteJsonLd());
}
