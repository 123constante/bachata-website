/**
 * buildVenueJsonLd — returns a Schema.org LocalBusiness JSON-LD blob
 * for a public venue page. Emitted as an inline <script> on the
 * detail page so search engines (and rich-result previews) can index
 * the venue with correct address, opening hours, and images.
 *
 * Per plan_seo_master.md Phase 1: SEO master plan calls for JSON-LD
 * across detail pages. Venue page is the first surface to land it.
 *
 * No verbose error handling — every field is optional and any missing
 * value just drops out of the emitted object. The caller stringifies
 * and inlines via dangerouslySetInnerHTML.
 */

type DayHours =
  | string
  | { open?: string | null; close?: string | null; isOpen?: boolean | null }
  | null
  | undefined;

const SCHEMA_DAY: Record<string, string> = {
  monday: 'https://schema.org/Monday',
  tuesday: 'https://schema.org/Tuesday',
  wednesday: 'https://schema.org/Wednesday',
  thursday: 'https://schema.org/Thursday',
  friday: 'https://schema.org/Friday',
  saturday: 'https://schema.org/Saturday',
  sunday: 'https://schema.org/Sunday',
};

export type VenueJsonLdInput = {
  name: string;
  description?: string | null;
  image?: string[] | null;
  address?: string | null;
  postcode?: string | null;
  city_name?: string | null;
  country?: string | null;
  telephone?: string | null;
  url: string;
  opening_hours?: Record<string, DayHours> | null;
};

export const buildVenueJsonLd = (v: VenueJsonLdInput): Record<string, unknown> => {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: v.name,
    url: v.url,
  };

  if (v.description) node.description = v.description;
  if (Array.isArray(v.image) && v.image.length > 0) node.image = v.image;

  if (v.address || v.postcode || v.city_name) {
    const postal: Record<string, string> = { '@type': 'PostalAddress' };
    if (v.address) postal.streetAddress = v.address;
    if (v.city_name) postal.addressLocality = v.city_name;
    if (v.postcode) postal.postalCode = v.postcode;
    if (v.country) postal.addressCountry = v.country;
    node.address = postal;
  }
  if (v.telephone) node.telephone = v.telephone;

  if (v.opening_hours) {
    const specs: Record<string, string>[] = [];
    for (const [day, raw] of Object.entries(v.opening_hours)) {
      const dayUri = SCHEMA_DAY[day.toLowerCase()];
      if (!dayUri) continue;
      if (raw == null || typeof raw === 'string') continue;
      const r = raw as { open?: string | null; close?: string | null; isOpen?: boolean | null };
      if (r.isOpen === false || !r.open || !r.close) continue;
      specs.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: dayUri,
        opens: r.open,
        closes: r.close,
      });
    }
    if (specs.length > 0) node.openingHoursSpecification = specs;
  }

  return node;
};
