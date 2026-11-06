# Brief: Details and Prices edit screens, every real event shape (tests only)
Brief-version: 2
Branch: claude/details-prices-shape-matrix
Lane: normal, Sonnet. bachata-website, tests only: no change to any src/** non-test file, no calendar density-exclusion file, no migration
Serves: organisers editing an event themselves; closes the 10 untested cells of Walk B (docs/handover/walk-edit-event-shapes.md)
## What main lacks
- Details screen tested on a one-off, a draft, a course and a weekly with a date that has its own changes -- grep: detailsShapeMatrix
- Prices screen tested on a one-off, a draft, a course and a paused series -- grep: pricesShapeMatrix
- A Details test for a festival (Prices has one, Details does not) -- grep: detailsFestivalShape
- extends: the slice row for this work in the organiser arc file -- docs/arcs/organiser.md
## Files
src/modules/organiser/p3/screens/__tests__/editShapes.matrix.test.tsx (new)
src/modules/organiser/p3/screens/__tests__/editScreens.send.test.tsx
src/modules/organiser/p3/screens/__tests__/wsFixtures.ts
docs/arcs/organiser.md
## What to build
1. Read editScreens.send.test.tsx first and reuse its helpers (show, DETAILS, PRICES, the mocked send). New file editShapes.matrix.test.tsx holds one table: rows = SHAPES keys oneoff, oneoffPast, draft, draftReady, course, courseDone, paused, festival, weekly (has_override date at 2026-11-13); columns = Details, Prices. Name the describe blocks detailsShapeMatrix, pricesShapeMatrix, detailsFestivalShape.
2. Per cell assert: the screen renders without error; locked shapes (ended, archived, past one-off) grey every field and the Save reason is shown; open shapes enable Save only after a change; an untouched Save sends nothing; one edited field sends exactly one series.upsert command with that field only.
3. Add a 13-date weekly shape to wsFixtures.ts (real prod shape: 33 of 44 live recurring series have 13 to 100 dates) and run the same cells on it; the weekly row proves the "Different on N dates" note (data-testid p3-different-on-*) shows for the date with its own changes.
4. Update the arc file row for this slice (Status, Blocked by, PR link) in the same PR.
## Tests
Table-driven, red first: before adding rows, show in the PR body that each new cell fails when its assertion is inverted (mutation check on two cells). If a cell exposes a real bug, do NOT fix src: mark it it.fails with a one-line reason and list it under Not verified.
## Done when
All new cells pass; `npx vitest run src/modules/organiser/p3/screens` green; tsc on changed files clean; PR body has Verified / Not verified (Shape survey counts quoted from Walk B: 44 live recurring, 11 live one-off, 8 live festival, 7 live course; no browser walk, tests only).
