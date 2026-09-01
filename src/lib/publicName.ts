/**
 * publicName -- the single authority for "what is this profile called?".
 *
 * Every public profile surface used to answer this question for itself, and the
 * three answers disagreed in three different ways on production (measured
 * 2026-07-28, still true 2026-09-01):
 *
 *   - /dancers/:slug   rendered `<h1>Dancer</h1>` for 44 live profiles, because
 *     the loader's column list omitted `display_name` -- where those names
 *     actually live.
 *   - /djs/:slug       rendered a raw UUID as its `<h1>` and `<title>`, because
 *     get_public_dj_v1's COALESCE chain ends in `dp.id::text`.
 *   - /organisers/:slug rendered "Organiser not found" (see app/routes/organiser.tsx).
 *
 * Google classified the results as Soft 404s. The shared rule below is what
 * stops the class recurring, and it has exactly one job: **return null rather
 * than invent a name**. A caller that gets null must make an explicit routing
 * decision (404, or 200 + noindex) instead of shipping a placeholder that reads
 * to a crawler as real content.
 *
 * NEVER FALL BACK TO AN ID. An id is not a name, and -- unlike an empty string --
 * it is truthy, so it silently satisfies every `entityName ?? 'Dancer'` guard
 * and every `!ctx.entityName` noindex test downstream (see
 * src/lib/seo/buildSeoForRoute.ts). That is precisely how a UUID reached the
 * indexed `<title>` of a live page.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trim, then treat whitespace-only as absent. `melvin` has `first_name = " "`
 *  in production, which is falsy for a human and truthy for JavaScript. */
const clean = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export type PublicNameSource = {
  id?: string | null;
  display_name?: string | null;
  dj_name?: string | null;
  name?: string | null;
  first_name?: string | null;
  surname?: string | null;
};

/**
 * Resolve the public-facing name for a person/organiser row, or `null` when
 * nothing usable resolves.
 *
 * Candidates are tried in order of authority: the curated `display_name`, then
 * a role-specific stage name, then a generic `name`, then first + surname. A
 * candidate is rejected -- not returned -- when it is blank, when it is the row's
 * own id, or when it is UUID-shaped from any source. The id checks are
 * deliberately belt-and-braces: `get_public_dj_v1` hands us the id in the
 * `display_name` FIELD, so comparing against `source.id` alone would pass it
 * through on any row where the two ids differ (a joined person/profile split),
 * and the shape check alone would pass a non-UUID primary key.
 */
export function resolvePublicName(source: PublicNameSource): string | null {
  const rowId = clean(source.id);

  const candidates = [
    clean(source.display_name),
    clean(source.dj_name),
    clean(source.name),
    [clean(source.first_name), clean(source.surname)].filter(Boolean).join(" ") || null,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (UUID_RE.test(candidate)) continue;
    if (rowId && candidate.toLowerCase() === rowId.toLowerCase()) continue;
    return candidate;
  }
  return null;
}

/**
 * The same resolution, rendered. Use ONLY where a human is looking at a screen
 * and a generic word beats an empty heading -- never for `entityName`, a
 * `<title>`, a canonical, or anything a crawler reads as the page's subject,
 * because a placeholder there is indistinguishable from a real name and
 * suppresses the noindex that a nameless profile is supposed to get.
 */
export function renderPublicName(source: PublicNameSource, fallback: string): string {
  return resolvePublicName(source) ?? fallback;
}
