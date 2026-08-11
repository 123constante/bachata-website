// What /api/og/bake is allowed to PERSIST -- the one rule, stated once, pure.
//
// THE DEFECT THIS CLOSES (queued finding 1f). api.og.bake.tsx renders a card
// through the same helpers as /api/og/card, uploads it to R2 under a
// cover-keyed IMMUTABLE object name, and records set_og_image_v1 status
// 'ready'. When the cover could not be fetched it rendered the branded
// FALLBACK card and persisted that, healthy, with no error. Three things then
// compound:
//
//   1. get_og_image_v1 serves any 'ready' row whose cover_hash matches the
//      page's cover token. For the cover-unfetchable case those tokens are the
//      SAME url, so the fallback card IS what every crawler receives.
//   2. resolveOgCardImage prefers the baked URL, so /api/og/card is never
//      fetched for that entity -- and the X-OG-Fallback marker finding 1a
//      added lives on that response. An R2 object carries no header. The
//      marker rule was therefore unreachable BY CONSTRUCTION for baked
//      entities, which is the half of the pipeline 1a could not see.
//   3. The object name is keyed on the cover URL, so nothing re-bakes it while
//      that cover stands. A single 5s fetch timeout during one bake poisons
//      every share of that entity permanently, and probing the cover later
//      reports it healthy -- the degrade left no trace anywhere.
//
// The rule: persist ONLY a card built from real, fetched cover bytes. Every
// other outcome records status 'error' with its reason, which (a) makes
// get_og_image_v1 stop serving the row immediately, so the page falls back to
// the live /api/og/card and 1a's marker becomes readable again, and (b) puts
// the row in _og_sweep's retry window (status <> 'ready', attempts < 5, every
// 2 minutes) so a transient failure re-bakes itself instead of setting.
//
// INCLUSION-SHAPED, and that is the whole point. Three conditions must ALL
// hold to persist; anything else refuses, including a combination this file
// did not anticipate. The exclusion form -- "refuse these known-bad cases" --
// is how a guard goes quiet on the case nobody thought of, and this codebase
// has paid for that shape more than once.

/** Reasons a bake refuses to persist. Deliberately the SAME strings as
 *  api.og.card.tsx's FallbackReason union, so `og_render.error` and an
 *  X-OG-Fallback header name the same condition with the same word and an
 *  operator reading either one is reading one vocabulary. They are not
 *  imported from there on purpose: that union is the wire format of a
 *  RESPONSE HEADER whose name is asserted in-place by
 *  tests/ogCardFallbackMarker.test.ts, and hoisting it into a shared module is
 *  queued as finding 1g/10a to be weighed once for both guards. Drift is made
 *  loud instead, by a cross-file assertion in
 *  tests/ogBakeDegradeRefusal.test.ts. */
export type BakeRefusalReason =
  | "card-data-unavailable" //  the RPC failed or returned nothing
  | "cover-absent" //           no cover URL to fetch at bake time
  | "cover-unfetchable"; //     had a cover URL, could not fetch it

/** `reason` is present on BOTH members, null on the persist one, rather than
 *  only on the refusal. tsconfig.app.json sets `strict: false`, which turns
 *  off the narrowing that would let `if (!d.persist)` give the refusal member
 *  its `reason` -- so the tidier two-shape union type-checks under the editor's
 *  config and fails the repo's actual one with four TS2339s. Same guarantee,
 *  spelled so it survives the compiler settings this repo really builds with. */
export type BakeDecision =
  | { persist: true; reason: null }
  | { persist: false; reason: BakeRefusalReason };

/** Booleans, not the values themselves, so the decision is provable without a
 *  Buffer, a network or a sharp install -- and so the ORDER of the checks is
 *  the whole of the logic under test. */
export function decideBakePersist(input: {
  hasCardData: boolean;
  hasCoverUrl: boolean;
  hasCoverBytes: boolean;
}): BakeDecision {
  if (!input.hasCardData) return { persist: false, reason: "card-data-unavailable" };
  // Ordered before the bytes check so a flyer-less entity is named for what it
  // is. Reversing these two would label an entity that HAD no cover URL
  // "unfetchable", routing an operator to storage for a resolver problem --
  // the same drift api.og.card.tsx hoists `hasCoverUrl` to prevent.
  if (!input.hasCoverUrl) return { persist: false, reason: "cover-absent" };
  // Reached only with a cover URL in hand, so "could not fetch it" is exact.
  // Also the reason bytes-without-a-url refuses rather than persisting: the
  // combination is unreachable from the route today, and a future edit that
  // made it reachable must not be granted a pass by this file's silence.
  if (!input.hasCoverBytes) return { persist: false, reason: "cover-unfetchable" };
  return { persist: true, reason: null };
}
