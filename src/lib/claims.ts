/**
 * claims -- the ONE sanctioned registry of genuine constant claims: values
 * asserted in JSON-LD that are NOT derived from any row and never will be,
 * each wrapped in `constantClaim` (src/lib/evidence.ts) with a dated source so
 * check-claim-provenance.mjs can allow it while every other bare string
 * literal in a guarded file stays a violation.
 *
 * A row here IS a claim -- the honest-claims arc (P7,
 * ~/.claude/plans/you-need-to-find-jolly-lark.md) exists because the site
 * asserted things exactly like this with no dated review behind them
 * (addressCountry: 'GB' on every event, regardless of which country the venue
 * was actually in). Wrapping a value here does not make it true forever; it
 * records who verified it and when, so staleness is checkable later
 * (check-claim-provenance.mjs's registry-staleness pass, reported separately
 * from provenance -- see that guard's header for why the two must never share
 * a gate).
 *
 * Do NOT add a row for something a row in the database could answer instead.
 * That is the P7 gate's whole point: OMIT (src/lib/evidence.ts's
 * omitIfUnknown) is the honest response to "we do not have this value", and a
 * claims.ts row is only for a value that structurally cannot come from a row
 * (our own brand facts, schema.org vocabulary syntax) or where the org made a
 * standing decision as-of a specific date pending a real column
 * (queued-jsonld-addresscountry-derivation.md is the example of the latter --
 * not yet added here because that derivation is still blocked, not because
 * the current code has no claim needing one).
 */

import { constantClaim } from './evidence';

/** buildEventJsonLd.ts and buildEventListJsonLd.ts both assert this,
 *  unconditionally, for every event: the calendar carries only in-person
 *  London-area nights, never an online/hybrid one. One row, both call sites,
 *  so a change of policy edits a single place instead of drifting between
 *  the two builders the way the two eventStatus ternaries independently
 *  duplicate schema.org's Cancelled/Scheduled pair (accepted duplication --
 *  those are conditioned on live is_cancelled data, not constant). */
export const EVENT_ATTENDANCE_MODE_OFFLINE = constantClaim(
  'https://schema.org/OfflineEventAttendanceMode',
  {
    claim: 'eventAttendanceMode',
    source:
      'Product decision: every listed event/occurrence is an in-person London-area night. ' +
      'No online or hybrid class/social has ever been listed.',
    verifiedOn: '2026-09-09',
    reviewEvery: '180d',
  },
);

/** buildOrganizationJsonLd.ts's areaServed. This is a claim about OUR OWN
 *  organization (which city we serve), not about any third-party event or
 *  venue -- the same self-referential class as the site's own name -- but it
 *  is still a claim, so it still gets a dated source rather than a bare
 *  literal. */
export const ORG_AREA_SERVED_CITY = constantClaim('London', {
  claim: 'Organization.areaServed.name',
  source: 'Product scope: London is the only active city (see project_city_catalog_model.md).',
  verifiedOn: '2026-09-09',
  reviewEvery: '365d',
});

export const ORG_AREA_SERVED_COUNTRY = constantClaim('GB', {
  claim: 'Organization.areaServed.addressCountry',
  source: 'London, the served city, is in the UK.',
  verifiedOn: '2026-09-09',
  reviewEvery: '365d',
});

/** buildOrganizationJsonLd.ts's description. Editorial copy about our own
 *  organization -- the P14 rule ("a claim about the DANCE is written by a
 *  human") applies here by extension: this is hand-authored brand prose, not
 *  a claim about a specific third-party event. Registered rather than left
 *  bare purely so the guard's deny-by-default stays uniform across this
 *  file -- there is no row this could come from instead. */
export const ORG_DESCRIPTION = constantClaim(
  "London's bachata community calendar - classes, socials, festivals, teachers and venues in one place.",
  {
    claim: 'Organization.description',
    source: 'Hand-authored brand copy, reviewed at PR time.',
    verifiedOn: '2026-09-09',
    reviewEvery: '365d',
  },
);

/** buildWebsiteJsonLd.ts's alternateName. */
export const WEBSITE_ALTERNATE_NAME = constantClaim('Bachata Calendar UK', {
  claim: 'WebSite.alternateName',
  source: 'Hand-authored brand copy, reviewed at PR time.',
  verifiedOn: '2026-09-09',
  reviewEvery: '365d',
});

/** buildWebsiteJsonLd.ts's SearchAction query-input spec. This is schema.org
 *  SYNTAX (the fixed grammar `required name=<paramName>`, naming the same
 *  `{search_term_string}` template token used two lines above), not a claim
 *  about our data -- closer in kind to `@type` than to a fact about an event.
 *  It is registered anyway rather than added as a THIRD exempt key, because
 *  P7's design deliberately keeps the exempt-key set at exactly two
 *  (@context, @type) so it cannot grow into the kind of enumerated
 *  allowlist the guard exists to avoid ([[proving_a_guard_can_break_it]]) --
 *  one more registry row is cheaper than a precedent for a bigger one. */
export const WEBSITE_SEARCH_QUERY_INPUT_SPEC = constantClaim(
  'required name=search_term_string',
  {
    claim: 'WebSite.potentialAction.query-input',
    source: "schema.org SearchAction syntax, paired with this file's own urlTemplate token.",
    verifiedOn: '2026-09-09',
    reviewEvery: '365d',
  },
);

/** buildOrganizationJsonLd.ts's sameAs: our own official channel list. */
export const ORG_SAME_AS = constantClaim(
  ['https://www.instagram.com/bachata.community.uk/'],
  {
    claim: 'Organization.sameAs',
    source: 'Official channel list, hand-maintained as new ones go live.',
    verifiedOn: '2026-09-09',
    reviewEvery: '180d',
  },
);

/** breadcrumbs/jsonLd.ts's auto-prepended position-1 crumb label. Every page
 *  using GlobalLayout renders this in a live BreadcrumbList; it is our own
 *  site's own name for its own home page, not a claim about any third party,
 *  but P7's guard is deny-by-default over string-literal-valued node
 *  properties, so it gets a dated row rather than staying a bare default
 *  parameter value (queued-jsonld-claim-provenance-guard-v2.md finding #5 --
 *  this is a real, currently-shipping instance of the defect class, fixed
 *  independently of when the guard itself ships). */
export const BREADCRUMB_HOME_LABEL = constantClaim('Home', {
  claim: 'BreadcrumbList.itemListElement[0].name',
  source: "Our own site's home page, named on every page via GlobalLayout.",
  verifiedOn: '2026-09-09',
  reviewEvery: '365d',
});
