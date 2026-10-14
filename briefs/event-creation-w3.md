# Brief W3 (Website): lists, Past section, one vocabulary, Type row removed

Branch `arc/event-creation-w3` FROM `main` AFTER Website #750 and admin #780 are merged (W1 and W2 may still be open: your files are disjoint). Push ONLY this branch. Open NO PR.
**Keep your session context under 35% (owner rule): read only what you edit, tail logs to 40 lines, commit and push early, leave the handover before ~30%.** Write shell commands WITHOUT variables, loops or `$(...)`. Check a PRODUCTION build. Read repo files with git, not `gh api`.
Hard rules: `src/lib/eventCategory.ts` byte-identical; never touch the calendar density-excluded files; `&hellip;` in JSX; explicit px tap targets; compact density.

## What and why
Prod audit (read-only, 2026-10-13): 64 live series, 14 of them live with ONLY past dates (7 one-off, 4 recurring, 2 course, 1 festival) that read "Live" forever; 2 duplicate live names. Owner decisions (settled): d39 the organiser editor DROPS the Type row (admin keeps its read-only Event type row); past events stay VISIBLE on the organiser Events list under a "Past" heading ("events should not be hidden"); d31 finished is display only, NO job, NO migration: one-off/course/festival with no upcoming date read "Finished"; a recurring series with no upcoming date reads "Nothing coming up" (add dates). Stored status never changes. d45 a party series reads "Party" everywhere on organiser screens.

## Build
1. ONE shared mapping (extend `shared/seriesModel.ts` `upcomingDates`/`firstListedDate` helpers, or a new `shared/lifeLabel.ts`) used by EVERY organiser screen for the same fact: status tag, list row subtitle, ended/lapsed wording. Never two copies.
2. `EventList.tsx`: sections Upcoming/Live first, then a collapsed "Past" with its count; rows show "Finished" or "Nothing coming up" from the shared mapping.
3. Remove the Type row from the editor (`EventEditorPage.tsx` Type row parts, `eventType.ts` `typeSublabel`/`TypeRowState` and tests). Where the person needs to know the type, show the SESSIONS (W2 adds them) not a type. Where copy names a type word, use the single word map: party -> "Party" (do NOT edit eventCategory.ts; map on the organiser side from one function).
4. `endedRun.ts` wording uses the same mapping (stored `workshop` already reads class).
5. Every empty state says what the person CAN do; no copy points at a control that is not on screen.

## Files you own
`EventList.tsx`, `endedRun.ts`, `takenOff.ts` if needed, `shared/seriesModel.ts`, `shared/eventState.ts`, new `shared/lifeLabel.ts`, Type-row parts of `eventType.ts`/`EventEditorPage.tsx`, their tests. W1 edits ONLY the chip table and `chipHint` in `eventType.ts`; W2 edits `EventEditorPage.tsx` for wiring only: touch just the Type-row hunks there and say which.

## Verify (all required)
Table-driven consistency test over EVERY shape x EVERY organiser screen: the fixtures S01-S15 (`events/__tests__/shapes/shapes.ts`) PLUS the 14 prod "live but only past dates" shapes plus a >100-date series: the same fact reads the same word on the list row, the status tag and the ended page. Red-first on the base; a mutant per rule. Run EVERY CI step (GitHub Actions + yourself). Walk 390x844 production build on prod-shaped branch data (Past section collapsed/expanded, Finished and Nothing coming up rows). Write `docs/handover/event-creation-w3.md`: checks table, Verified / Not verified, new-logic lines.
