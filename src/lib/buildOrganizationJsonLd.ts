/**
 * Schema.org Organization JSON-LD.
 *
 * Helps Google build a brand knowledge panel and disambiguate the site
 * from other "Bachata Calendar" hits. Emit once, on the homepage only.
 *
 * sameAs surfaces our social presence — update these whenever a new
 * official channel goes live.
 */

import { SITE_NAME, SITE_ORIGIN } from './seo';

const SAME_AS: string[] = [
  // Official channels. Add WhatsApp / Facebook profile URLs here as they go live.
  'https://www.instagram.com/bachata.community.uk/',
];

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
    description:
      "London's bachata community calendar - classes, socials, festivals, teachers and venues in one place.",
    areaServed: {
      '@type': 'City',
      name: 'London',
      addressCountry: 'GB',
    },
    sameAs: SAME_AS,
  };
}

export function renderOrganizationJsonLd(): string {
  return JSON.stringify(buildOrganizationJsonLd());
}
