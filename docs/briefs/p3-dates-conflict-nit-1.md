# BRIEF: p3-dates-conflict-nit-1 (Website; normal lane; Sonnet; copy/UI only)

Brief-version: 2

Walk of PR #1316 (docs/walk/p3-batch-1/RESULTS.md, merged to main as #1319 or on branch claude/walk-p3-batch-1) found one NIT: on a save version conflict the date sheet shows TWO messages stacked: the old generic "Someone changed this first. Check it." (a red `p3-sheet-error`) and the new W-35 reason in `ConflictNote` ("Someone else saved a change to this date, so yours was not saved. Start again to see it..."). Picture: `docs/walk/p3-batch-1/dates/pics/w35-put-2-conflict.png`.

## What main lacks
- extends: only ONE message on a version conflict: the generic line is suppressed when `conflict` is true (the ConflictNote already says it); the rendering of the error line lives in DateFieldSheets.tsx (also in Files) -- src/modules/organiser/p3/screens/DateSheet.tsx
- extends: a test that pins it: a conflict shows `p3-conflict-why` and NO `p3-sheet-error` / "Check it" text on the Name, Photos, Price, About and Ticket sheets; a non-conflict error (offline, refused) still shows its own line -- src/modules/organiser/p3/screens/__tests__/datesFix.matrix.test.tsx

## Files
- src/modules/organiser/p3/screens/DateSheet.tsx
- src/modules/organiser/p3/screens/DateFieldSheets.tsx
- src/modules/organiser/p3/screens/__tests__/datesFix.matrix.test.tsx
- docs/handover/p3-dates-conflict-nit-1.md

## What to build
1. Red first: add the test cells; run them against current main and keep the red output in the handover.
2. Fix: where `error` is rendered with `conflict` true, do not render the generic error (or do not set it for a version conflict). Keep every other error path unchanged. Do not touch the VERSION_CONFLICT constant (other screens use it).
3. Run: `npm run lint`, `vitest run src/modules/organiser`, `npm run check:integrity`, `npm run check:mojibake`. Write test regexes with \u escapes.
4. Real-data lines in the PR body: shapes = the 5 sheets x {conflict, offline, refused}. Phone QA: sizes 390x844, Walked: by the test matrix only, Not verified: browser picture.
5. Push once; last commit subject ends `[worker-done <ticket>]`. No walk (the lead walks).
