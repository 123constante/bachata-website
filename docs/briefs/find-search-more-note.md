# Brief: Find your page says when the list is cut short (P3)
Brief-version: 2
Branch: claude/find-search-more-note
Lane: normal, Sonnet. Website only, no database change. Must not touch claim_organiser_v1, hints, or the legacy NewPageFlow behaviour.
Serves: an organiser searching for their own page during claim and onboarding.

## What main lacks
- extends: Find returns the first 8 matches by name (`.limit(8)`) and says nothing when more exist, so a short term can push the right page off the list with no way to know -- src/modules/organiser/shared/selfServeApi.ts
- A visible line when more than 8 pages match: "Showing the first 8. Type more of the name to narrow it." -- grep: p3-ob-find-more
- A named limit constant so the screen and the query agree -- grep: FIND_LIMIT

## Files
- src/modules/organiser/shared/selfServeApi.ts
- src/modules/organiser/p3/onboarding/pageApi.ts
- src/modules/organiser/p3/onboarding/OnboardingFlow.tsx
- src/modules/organiser/p3/onboarding/__tests__/findMore.matrix.test.tsx (new)
- docs/arcs/organiser.md (update the "Walk-report dead ends A to D" row: Status, Blocked by, PR link, in the same PR)

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. Export `FIND_LIMIT = 8` in selfServeApi and give `searchClaimableOrganisers(query, limit = FIND_LIMIT)` the optional limit. Default behaviour and the NewPageFlow caller stay byte for byte.
2. The P3 `findPages` read asks for `FIND_LIMIT + 1`; FindStep shows only the first `FIND_LIMIT` rows and, when a ninth came back, the note (`data-testid="p3-ob-find-more"`, role status, text-sm).
3. Results of 0 to 8 rows show no note; the empty, error (retry) and searching states are unchanged.

## Tests (red first)
Table: matches {0, 1, 8, 9, 20} x rows shown {0, 1, 8, 8, 8} x note {no, no, no, yes, yes}; error state still shows `p3-ob-find-retry`; NewPageFlow still receives at most 8 rows. Run against unfixed code first; the 9 and 20 rows must be red.

## Done when
Matrix green, onboarding and newpage suites green, PR checks green, INVENTORY.md coverage count stated. PR body carries Verified / Not verified (prod has 50 live pages, so most terms show no note; no real sign-in).
