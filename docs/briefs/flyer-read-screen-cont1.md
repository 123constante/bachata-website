# Brief: flyer read screen, continuation 1 (review fixes D1, D2, D5, D7)
Brief-version: 2
Branch: claude/flyer-read-screen
Lane: normal, Opus. CONTINUATION on the existing branch and PR #1498 (head ec27e2cc). Fix exactly the findings below; change nothing else.
Serves: the independent review in docs/review/flyer-read-screen-1498.md (branch claude/review-flyer-read-screen-1498): one contract FAIL (R16) and three small defects.

## What main lacks
- D1 (contract R16, FAIL): the flyer-sourced cover cannot be removed before saving; add a "Remove photo" control (explicit 44px+ tap size, plain words) next to "Choose a different photo" in the cover card (CreateFlow.tsx around the cover card) that clears the cover, plus a test that it clears it and that saving then sends no cover -- grep: Remove photo
- D2: a good read waits on the venues query (FlyerStart.tsx venues.isPending); if the venue list never settles the person is stuck on "Reading your flyer..." with only Cancel. After 8 seconds of waiting on venues, continue WITHOUT venue matching (venue name kept as a "flyer said" note) and say so in one line; add a test with a never-settling venues query -- grep: continue without venue matching
- D5: the daily-limit title hard-codes the number 5 (FlyerStart.tsx); remove the number from the copy (say "today's flyer reads") so the function owns the limit -- grep: today's flyer reads
- D7: the not-enough card title always says "date and venue" even when only the name is missing; use the note text from flyerToDraft for the missing part -- grep: flyerToDraft missing part

## Files
- src/modules/organiser/p3/new/CreateFlow.tsx
- src/modules/organiser/p3/new/FlyerStart.tsx
- src/modules/organiser/p3/new/__tests__/flyerStart.render.test.tsx
- docs/handover/flyer-read-screen-cont1.md (new)

Leave D3, D4, D6, D8 alone (parked). Entities not &mdash; use HTML entities for punctuation in JSX. Push once at the end; last commit subject ends with the worker-done marker. Handover states head SHA and the per-job CI table.
