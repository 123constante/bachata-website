# Brief: flyer reader fixes 1 (whole-arc review blockers N1, N2, N3, N5, N4, D4)
Brief-version: 2
Branch: claude/flyer-read-fixes-1
Lane: normal, Opus. NEW branch from main (slices 2 and 3 are merged). Red-first tests: run each new test against unfixed code first and say so in the handover.
Serves: docs/review/flyer-arc-whole.md on branch claude/review-flyer-arc (read it first): "Ready to turn on: NO", blockers N1-N3. Contract: docs/briefs/flyer-arc-contract.md on brief/review-flyer-arc.

## What main lacks
- N1 (HIGH): a repeating flyer (weekly/monthly) with a printed date ignores it: flyerToDraft.ts takes the weekday branch first and uses nextDateOnWeekday, so a "1st Saturday" flyer becomes the 2nd Saturday with a wrong monthly rule and no doubtful mark. Fix: when a printed date exists keep it (and its weekday and nth); mark firstDate doubtful if the date was only computed from a weekday or if the printed date is past; never move a printed past date forward; the monthly rule must match the printed nth. Tests from the contract shapes: flyers 1, 4, 5 and a dated past weekly and a dated past monthly -- grep: printed date kept on repeating
- N2 (MEDIUM): bare domains (bachata.co.uk/tix, salsa.london) survive cleanText; strip domain-shaped tokens with a TLD (keep the ticket link field path unchanged); test a title containing one -- grep: bare domain stripped
- N3 (MEDIUM): attempts-limit card says "Wait a few minutes"; the cap is 15 a day. Use the same shape as the daily-limit card (back at the reset time in London, else "back tomorrow"); test it -- grep: attempts limit back tomorrow
- N5 (LOW): unknown currency becomes GBP; produce no ticket row instead; test -- grep: unknown currency no row
- N4 (LOW): fixture row 7 has a venue; make it the contract shape (course, no date, no venue) so the not-enough path is tested; add a P4 (no page) render test for R1
- D4 (LOW): add flyer_read_saved to AnalyticsEventMap and drop the cast in useFlyerRead.ts -- grep: flyer_read_saved AnalyticsEventMap

## Files
- src/modules/organiser/p3/new/flyerToDraft.ts
- src/modules/organiser/p3/new/FlyerStart.tsx
- src/modules/organiser/p3/new/useFlyerRead.ts
- src/lib/analytics.ts
- the existing flyer tests and fixtures under src/modules/organiser/p3/new/__tests__/ (edit in place)
- docs/handover/flyer-read-fixes-1.md (new)

Leave D3, D6, D8 alone. Entities not Unicode punctuation in JSX. Push once at the end; last commit subject ends with the worker-done marker. Handover: head SHA, per-job CI table, red-first evidence.
