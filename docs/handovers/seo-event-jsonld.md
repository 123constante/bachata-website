# Handover: seo-preview red on #1543 (Event JSON-LD missing)

Brief: `docs/briefs/seo-event-jsonld.md` on `brief/fix/gateretry-matrix-flake`.
Branch `fix/gateretry-matrix-flake`, PR #1543. No DB change; Supabase read-only.

## Root cause: the guard, not the renderer
- Read-only on prod (2026-11-11): `event_series_p5` slugs `rogue-bachata` and
  `rogue-bachata-wednesday` are `lifecycle_status = 'paused'` (prod totals: live 72,
  ended 24, paused 3, archived 654, draft 13).
- `eventJsonLdPolicy` (`src/lib/seo/eventPageSeoPolicy.ts`, owner decision (a),
  2026-10-08, marked final) says a paused series renders 200, indexable, in the sitemap,
  with the "On hiatus" banner and **no Event node** (its only date already ran;
  EventPostponed + that date would be false). `buildEventJsonLd` returns null for it.
- `scripts/check-seo.mjs` samples the 4 most recently edited `/event/` sitemap URLs and
  hard-required an Event node on every one. Two paused series were edited, so it went red.
- The brief's step 2 ("emit a valid Event node whenever the page renders") would reverse
  that owner decision, so it was NOT done. What the brief asked for is enforced for every
  non-paused shape instead (see the tests below). If the owner now wants a node on paused
  pages, that is a change to `eventJsonLdPolicy`, plus flipping the guard's paused arm.

## What changed
1. `scripts/check-seo.mjs`
   - Paused arm: an `/event/` page whose server HTML carries
     `data-testid="event-paused-banner"` (EventPausedBanner) passes with no Event node,
     and FAILS if it does carry one (it would contradict the policy). The arm keys on the
     attribute, not on the words "On hiatus", so prose cannot trigger it.
   - New floor `eventNodesAsserted` (min 1): a sample of only paused pages can no longer
     green the event floor with no Event node checked at all. `eventsAsserted` (min 3)
     still counts paused pages, because their contract is asserted, not skipped.
   - Canary: 80 cases (was 71), now with paused cases in both directions, the checkPage/tally
     mapping and the new floor. Red first: with the marker regex made to never match,
     exactly the 4 paused-dependent cases fail.
2. `src/lib/buildEventJsonLd.shapes.test.ts` (new): a table over 13 non-paused shapes (full, no end,
   no venue, empty venue, no image, empty image list, no description, past date, ended,
   recurring next date, cancelled, null lifecycle, bare minimum). Each must give an Event
   node with name, startDate and eventStatus, leave missing optional fields out, and
   serialise. Paused gives null. A producer/consumer pin checks that the banner's server
   render contains the exact marker the guard uses.
   Red first: the renderer had no bug, so a mutant was used instead (always writing
   `endDate`). It fails 2 rows (`no end date`, `bare minimum`), then was reverted.

## Not changed
- gateRetry test change (as the brief says). `eventJsonLdPolicy` / `buildEventJsonLd` (no product change).

## Status / not verified
- The guard was not run against the preview from the sandbox: the proxy blocks outbound
  requests to `*.vercel.app`, `api.vercel.com` and the live site (CONNECT 403). The CI
  `seo-preview` job is the real check.
- No check that the LIVE server HTML for a paused page contains the banner marker. If it
  does not, seo-preview stays red with `no Event JSON-LD node` (it fails closed, so the
  error is never hidden).
- tsc run on 777521b: 0 errors in branch files (0 errors across the repo). Later commits change only docs.
- PR #1543 body updated; `check-pr-real-data-verified` and `check-pr-phone-qa` both exit 0 locally.
- PR #1543 already had the label `automerge-ok`, added for the original test-only diff. It now also changes a CI guard script
  (`scripts/check-seo.mjs`), so the owner may want to remove the label and review the change first.
