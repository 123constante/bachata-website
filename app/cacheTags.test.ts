import { describe, it, expect } from "vitest";
import {
  REVALIDATABLE_ENTITY_TYPES,
  type EntityType,
  entityTag,
  purgeTagsFor,
  ALL_ROUTE_STAMPS,
  STAMP_ONLY_KINDS,
  STAMP_PLACEHOLDER_ID,
} from "./cacheTags";

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

  it("has no duplicate entity types", () => {
    expect(new Set(REVALIDATABLE_ENTITY_TYPES).size).toBe(REVALIDATABLE_ENTITY_TYPES.length);
  });
});
