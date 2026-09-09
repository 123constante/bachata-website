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
import { serialiseJsonLd } from '@/lib/serialiseJsonLd';
import { WEBSITE_ALTERNATE_NAME, WEBSITE_SEARCH_QUERY_INPUT_SPEC } from './claims';

export function buildWebsiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    alternateName: WEBSITE_ALTERNATE_NAME,
    url: SITE_ORIGIN,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_ORIGIN}/search?q={search_term_string}`,
      },
      'query-input': WEBSITE_SEARCH_QUERY_INPUT_SPEC,
    },
  };
}

export function renderWebsiteJsonLd(): string {
  return serialiseJsonLd(buildWebsiteJsonLd());
}
