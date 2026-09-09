/**
 * Schema.org Organization JSON-LD.
 *
 * Helps Google build a brand knowledge panel and disambiguate the site
 * from other "Bachata Calendar" hits. Emit once, on the homepage only.
 *
 * sameAs surfaces our social presence — add new official channels to
 * ORG_SAME_AS in src/lib/claims.ts as they go live, not here.
 */

import { SITE_NAME, SITE_ORIGIN } from './seo';
import { serialiseJsonLd } from '@/lib/serialiseJsonLd';
import { ORG_AREA_SERVED_CITY, ORG_AREA_SERVED_COUNTRY, ORG_DESCRIPTION, ORG_SAME_AS } from './claims';

export function buildOrganizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_ORIGIN,
    // Square logo for the brand knowledge panel (Google prefers a square,
    // legible mark here over the 1200x630 OG card).
    logo: {
      '@type': 'ImageObject',
      url: `${SITE_ORIGIN}/apple-touch-icon.png`,
      width: 180,
      height: 180,
    },
    description: ORG_DESCRIPTION,
    areaServed: {
      '@type': 'City',
      name: ORG_AREA_SERVED_CITY,
      addressCountry: ORG_AREA_SERVED_COUNTRY,
    },
    sameAs: ORG_SAME_AS,
  };
}

export function renderOrganizationJsonLd(): string {
  return serialiseJsonLd(buildOrganizationJsonLd());
}
