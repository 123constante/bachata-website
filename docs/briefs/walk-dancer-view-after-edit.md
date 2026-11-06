# Brief: walk D -- what a dancer sees on the public organiser and event page after an organiser edits (REPORT ONLY), Sonnet

Brief-version: 2

Lane normal, model Sonnet, branch `claude/walk-dancer-view-after-edit`. REPORT ONLY: no product code, no feature PR, no `.github/**`. Supabase read-only (prod `stsdtacfauprzrdebmzg`, counts only, no personal data). Under 40% context. Push ONCE; last commit subject ends `[worker-done <ticket>]`.

## Why
Owner goal: an organiser updates an event themselves and it shows right for dancers. If the edit does not visibly land (cover, Where, ticket link, share link), the organiser decides it did not work. This walk checks the public side at 390x844 against what P3 lets them change.

## What main lacks
- a field-by-field report: each field P3 can change vs where it appears on the public organiser page and event page, file:line, and any field that saves but does not show -- docs/handover/walk-dancer-view-after-edit.md
- (optional) one phone spec rendering the public organiser page and `/event/:id` with a changed cover, venue and ticket link on fake Supabase, 390x844 pictures -- tests/e2e-phone/walk-dancer-view-after-edit.spec.ts

## Files
- docs/handover/walk-dancer-view-after-edit.md
- tests/e2e-phone/walk-dancer-view-after-edit.spec.ts (only if no existing spec reaches it)

## Do
1. INVENTORY first: P3 editable fields (`p3/data/details.ts`, `prices.ts`, `eventPage.ts`, `screens/DetailsScreen.tsx`, `PricesScreen.tsx`) vs the public event page (`src/modules/event-page/bento/BentoPage.tsx`, `bento/blocks/CoverBlock.tsx`; `sections/` is mostly dead, prove an importer before citing) vs the public organiser page (`src/pages/OrganiserProfile.tsx`, `src/modules/profile/organiserPublicProfile.ts`, `OrganiserTeamSection.tsx`). Table with file:line each; mark SHOWS / HIDDEN / STALE.
2. Where: venue reads use `COALESCE(co.venue_id, e.venue_id)` (`.claude/rules/data-contracts.md`); check the P3 venue edit reaches that read. Share link: check what the organiser copies and where it lands.
3. Run existing evidence: vitest `p3/screens/__tests__/dancerView.matrix.test.tsx`, `src/modules/profile/__tests__/organiserPage.matrix.test.tsx`, `p3/screens/__tests__/eventPage.matrix.test.tsx`; phone spec `tests/e2e-phone/organiser-hero-owner.phone.spec.ts` and the picture helper in `tests/e2e-phone/helpers.ts`. Open every picture before describing it.
4. Prod SHAPES, counts only: events with no cover, no venue, no ticket link; organiser pages with no cover or no team.
5. Rank worst first (max 10) by "would an organiser give up here"; coverage count at the end (N fields, N SHOWS, N HIDDEN, N STALE).

## Not verified (write this block honestly)
A real edit then a real public reload after cache expiry (CDN, OG and share previews on a real device), real sign-in, a real phone. Fake Supabase and code reading only.

## Hard rules
Do not edit `src/**`; do not touch the density-exempt calendar files (CLAUDE.md). Handover line `DONE [worker-done <ticket>]`.
