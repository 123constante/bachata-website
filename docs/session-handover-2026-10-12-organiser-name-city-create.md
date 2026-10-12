# Session handover 2026-10-12: organiser Name/City pencils + Create event

Branch: `feat/organiser-name-city-create-event` (off main `0ff8fe7`). PR: see the PR for this branch (opened in the same session; its number is in the PR list).

## Done
- Name and City editable in place on `/organisers/:id` (owner/manager layer only), in the one Save (`organiser_profile_update_p5_v1`, `name` + `city_id`).
- Owner/manager-only Create event: beside the "Upcoming events" count, in the empty states. Links to `/account/o/events/new?o=<organiser id>`; `NewEventPage` now preselects `?o=`.
- Tests: name/city in every table-driven test (red first: 63/280 failed on unfixed code); ownership x events-shape matrix (7 roles x 3 shapes); phone spec `tests/e2e-phone/organiser-name-city-create.phone.spec.ts` (18 checks); full phone suite 74/74.
- `/code-review high` round 1: 5 of 8 findings fixed in this PR.

## Open
- CI on the PR (Phone QA runs the review-fix commit through the phone suite for the first time).
- Owner decision: "No upcoming nights" (past nights only) says **Create an event**, not "Create your first event" (the organiser has had nights). Change it if the brief's wording is wanted.
- Review round 2 was not run (two-round limit for user-facing changes; round 1's fixes are unreviewed code).
- Follow-ups from review (not fixed, refactors): drop the extra `resolveCanonicalCity` round trip per pick (seed the `['city-canonical', id]` cache from the search row); a shared `useCitySearch` hook (debounce now copied in CityView, OrganiserSheet, CitySheetBody); split City out of `FieldSheet` into its own sheet component.

## Next
1. Watch the PR's CI; fix anything red.
2. Owner phone test: rename (try a taken name), change the city, tap Create event (do not finish creating on prod unless intended).
