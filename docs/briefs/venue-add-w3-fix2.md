# Venue add W3: review round 2 fixes (website#2530)

Design: DESIGN-REGISTRY.md rows "Venue add + addresses" / "VENUE ADD DANCER FACTS" (mockup https://claude.ai/artifact/JUNjaPaSYWgPq5rCEjsxmJ). Same branch: `feat/venue-add-display`, PR #2530. Earlier briefs on this brief branch: `docs/briefs/venue-add-w3-display.md`, `docs/briefs/venue-add-w3-fix.md`.
Model: sonnet. Kind: ui.
Size: 4 files, 150 lines (formatVenueAddress.ts + its test, VenueFeedbackSheet.tsx + its test).

## Must fix (BLOCK, review r2 Opus at 0769611)
1. `src/lib/formatVenueAddress.ts:31-45`: the city strip only matches at the very end, so a trailing country defeats it. Real prod row: address "Carrer del Pla de la Torre, 14, 08398 Santa Susanna, Barcelona, Spain", city Barcelona. Today it renders "…, Barcelona, Spain, Barcelona". Fix: first strip a trailing `,\s*<country>` segment (Spain, España, UK, United Kingdom, England, GB, Türkiye, Turkey, or the venue's own country value, case-insensitive). Then do not append the city when the address already contains it as a whole comma segment. Add this row and the other 4 non-UK prod shapes to the test table (survey: `select address, postcode, country from venues where coalesce(country,'') not in ('GB','United Kingdom')` with a read-only query; business addresses only).

## Also fix (nits)
- VenueFeedbackSheet: before navigating to Sign in, save the typed text to sessionStorage key `venue-feedback:<venueId>`, and restore it on mount. Wrap both in try/catch, because typed input must never be lost.
- Signed-out prompt: add `role="status"` on the prompt `<p>` and move focus to the Sign in button.
- Error lines: add `role="alert"`. Add a `DialogDescription` (or `aria-describedby={undefined}`).
- Use HTML entities in JSX, never raw Unicode punctuation. Tap targets in explicit px.

## Do not
Change nothing visible with VITE_ENABLE_VENUE_ADD off. No anon RPC.

## Done
Push to `feat/venue-add-display`; final commit subject carries `[worker-done <ticket>]`; unit CI green at head; update the PR body "Verified on real data" block.
