# ER-C5 handover: venue picker with "Add a new venue"

Branch `claude/er-c5-venue` (from `claude/er-s1-rules`, PR 903). Touches only `src/modules/organiser/venue/**` plus parked/handover docs. Server NOT landed.

## Pinned interface for later slices
`import { VenuePicker } from '@/modules/organiser/venue'`
```ts
<VenuePicker options?: VenueOption[]  /* default: useVenueOptions() */
             onPick={(v: VenueOption) => void}
             deps?: { lookup, similar, create } />   // deps = test seams
```
`onPick` fires for: an existing venue, a similar venue, an `existing:true` answer, or a newly created draft (usable at once; option carries id, name, postcode, area, address). Also exported: `createVenueDraft`, `similarVenues`, `VenueApiError('rate_limited'|'unavailable'|'failed')`, `lookupPostcode`, `normalisePostcode`, `searchVenues`.
Files: `venueSearch.ts` (shapes idle/none/exact/partial; Add offered at 2+ letters, rendered under results), `postcode.ts` (postcodes.io; failures bad / not_found / offline, offline has a Try again), `venueApi.ts` (owner_create_venue_draft_v1, owner_similar_venues_v1), `VenuePicker.tsx` (search -> name+postcode -> Look up postcode (address, area, map pin) -> Next -> "Is it one of these?" (tap a venue or "No, it's a new venue"; skipped when none) -> Add venue).

## Done / left
Done: all of the brief. Left: mounting the picker in the event sheets (the Where/venue change rows) is for the integrating slice; the picker is not on any route yet.

## Verified on real data
- Read-only survey (prod `stsdtacfauprzrdebmzg`, counts only): venues = 66 (dancer_ready 31, published 24, draft 11); 1 draft has no postcode, 0 elsewhere. Small list, so client-side search is enough; the picker lists drafts through `get_organiser_venue_options_v1`.
- Tests: 30 in `venue/__tests__/venue.test.tsx` (search shapes idle/none/exact/partial/postcode-text, postcode shapes incl. bad/404/500/throw/no coords, RPC arg + error mapping, duplicate paths: similar-pick creates nothing, existing:true picks the old venue, No-new-venue goes on; lookup errors with retry that recovers; failed create keeps Add venue).

## Phone QA (390x844)
NOT done: the picker is not mounted on a route, so there is nothing to walk in a browser. Tap targets are explicit px (48/52/56px). Needs the integrating slice.

## CI steps (sandbox)
| Command | Exit |
|---|---|
| `npm run build` | 0 |
| `npx vitest run src/modules/organiser` (123 files, 3454 tests) | 0 |
| `npx eslint src/modules/organiser/venue` | 0 (clean) |
| `npm run lint` | 19 of 20 links pass; `check:integrity` exit 126 (script lacks exec bit in this checkout); `bash bin/check-integrity.sh` exit 0 (2045 files, 0 issues); the trailing `eslint .` skipped by the chain |
| `npx tsc --noEmit -p tsconfig.app.json` | pre-existing errors elsewhere; none in `organiser/venue` |

## Not verified
End-to-end against the real RPCs (server not landed: AD1); real postcodes.io call (tests fake fetch); phone walk; screenshots.
