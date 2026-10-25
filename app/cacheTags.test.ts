import { describe, it, expect } from "vitest";
import { routeStampCalls } from "./routeStampCalls";
import {
  REVALIDATABLE_ENTITY_TYPES,
  type EntityType,
  entityTag,
  purgeTagsFor,
  ALL_ROUTE_STAMPS,
  STAMP_ONLY_KINDS,
  STAMP_PLACEHOLDER_ID,
  cityTag,
  HOME_FEED,
  SEO_LANDING,
} from "./cacheTags";
import { SEO_LANDING_CITY_SLUG } from "@/lib/seoLandingEvents";

// The cache-tag conformance contract (admin ADR-015). Guards against the drift
// that caused the map-cover staleness bug: a tag stamped by a page that no write
// purges (→ page goes stale on that entity's change), or a write purging a tag no
// page stamps (→ the purge silently hits nothing). Run in the `test:unit` gate.

const ID = STAMP_PLACEHOLDER_ID;

// Every distinct tag-kind stamped across all routes (comma-joined strings split).
const stampedKinds = new Set(ALL_ROUTE_STAMPS.flatMap((s) => s.split(",")).map((t) => t.trim()));

// Every distinct tag-kind purged by any entity write (placeholder id).
const purgedKinds = new Set(
  REVALIDATABLE_ENTITY_TYPES.flatMap((t) => purgeTagsFor(t as EntityType, ID)),
);

const stampOnly = new Set(STAMP_ONLY_KINDS);

describe("cache-tag invalidation contract", () => {
  it("purges nothing that no page stamps (every purge tag has a stamping route)", () => {
    const orphanPurges = [...purgedKinds].filter((tag) => !stampedKinds.has(tag));
    expect(orphanPurges, `purge tags with no stamping route: ${orphanPurges.join(", ")}`).toEqual(
      [],
    );
  });

  it("leaves no stamped page un-purgeable (stamped tag is purged, or explicitly STAMP_ONLY)", () => {
    const unpurgeable = [...stampedKinds].filter(
      (tag) => !purgedKinds.has(tag) && !stampOnly.has(tag),
    );
    expect(
      unpurgeable,
      `stamped tags nothing purges and not in STAMP_ONLY_KINDS (they will go stale on content change): ${unpurgeable.join(", ")}`,
    ).toEqual([]);
  });

  it("keeps the STAMP_ONLY allowlist honest (each entry is actually stamped-but-unpurged)", () => {
    const staleAllowlist = [...stampOnly].filter(
      (tag) => !stampedKinds.has(tag) || purgedKinds.has(tag),
    );
    expect(
      staleAllowlist,
      `STAMP_ONLY_KINDS entries that are no longer stamped-but-unpurged (remove them): ${staleAllowlist.join(", ")}`,
    ).toEqual([]);
  });

  it("gives every revalidatable entity type a purge mapping that self-purges its detail page", () => {
    for (const t of REVALIDATABLE_ENTITY_TYPES) {
      const tags = purgeTagsFor(t as EntityType, ID);
      expect(tags.length, `purgeTagsFor("${t}") returned no tags`).toBeGreaterThan(0);
      expect(
        tags,
        `purgeTagsFor("${t}") must include its own detail tag ${entityTag(t as EntityType, ID)}`,
      ).toContain(entityTag(t as EntityType, ID));
    }
  });

  // S7c: the contract above reads ALL_ROUTE_STAMPS, a hand-kept list. Every stamp call a route
  // module really makes (an id-taking helper; a second argument is a flag, so both its values) must
  // be on that list, or a route could stamp a tag kind the contract never sees.
  it("lists in ALL_ROUTE_STAMPS every id-keyed stamp a route module makes (not stampHome or zero-argument stamps), flag ON and OFF", () => {
    const listed = new Set(ALL_ROUTE_STAMPS);
    const calls = routeStampCalls();
    expect([...new Set(calls.filter((c) => c.flagged).map((c) => c.file))].sort()).toEqual([
      "routes/dancers.tsx",
      "routes/people.tsx",
    ]);
    const missing = calls.flatMap(({ file, stamp, flagged }) =>
      (flagged ? [false, true] : [false])
        .map((on) => stamp(ID, on))
        // stampHome takes a city slug, listed under its own placeholder: not an id-keyed page.
        .filter((s) => !s.includes("city-") && !listed.has(s))
        .map((s) => `${file}: ${s}`),
    );
    expect(missing).toEqual([]);
  });

  it("has no duplicate entity types", () => {
    expect(new Set(REVALIDATABLE_ENTITY_TYPES).size).toBe(REVALIDATABLE_ENTITY_TYPES.length);
  });

  it("keeps cacheTags.ts's SEO_LANDING_CITY_SLUG duplicate in sync with seoLandingEvents.ts", () => {
    // cacheTags.ts duplicates this literal instead of importing the SEO landing
    // module (see its own comment) — this is the check that catches drift.
    expect(SEO_LANDING_CITY_SLUG).toBe("london-gb");
  });

  it("scopes event/festival purges to the resolved city when citySlug is given", () => {
    for (const t of ["event", "festival"] as const) {
      const scoped = purgeTagsFor(t, ID, "manchester-gb");
      expect(scoped).toContain(cityTag("manchester-gb"));
      expect(scoped).not.toContain(HOME_FEED);
      expect(scoped).not.toContain(SEO_LANDING);
    }
  });

  it("includes SEO_LANDING in a city-scoped purge only for the SEO landing pages' own city", () => {
    for (const t of ["event", "festival"] as const) {
      expect(purgeTagsFor(t, ID, SEO_LANDING_CITY_SLUG)).toContain(SEO_LANDING);
    }
  });

  it("falls back to the global purge when citySlug is omitted or null", () => {
    for (const t of ["event", "festival"] as const) {
      expect(purgeTagsFor(t, ID)).toEqual(purgeTagsFor(t, ID, null));
      expect(purgeTagsFor(t, ID)).toContain(HOME_FEED);
      expect(purgeTagsFor(t, ID)).toContain(SEO_LANDING);
    }
  });
});
