# BRIEF: p3-different-on-n-dates continuation (Website only; normal lane; Sonnet; merge-conflict round, no new scope)

Brief-version: 2

Situation: PR #1406 (branch claude/p3-different-on-n-dates, head 1ba11af3) is CONFLICTING with main. Main gained #1346 (47e1aa746, "this date only / all dates" prompt in Details and Prices) after the first worker started. Both change src/modules/organiser/p3/screens/DetailsScreen.tsx and PricesScreen.tsx. Nothing else conflicts (labels.ts auto-merges). Original brief: brief/p3-different-on-n-dates (read it for intent).

## What main lacks
- the "Different on N dates" line under Details and Prices on top of the #1346 prompt flow -- grep: differentDatesCount
- override_keys parsed on WorkspaceDate in the shared model -- src/modules/organiser/p3/model/differentDates.ts

## Files
- src/modules/organiser/p3/screens/DetailsScreen.tsx (resolve conflict)
- src/modules/organiser/p3/screens/PricesScreen.tsx (resolve conflict)
- docs/handover/p3-different-on-n-dates.md (append a "conflict round" section)
Do NOT touch anything else unless a test needs a fixture line. No new features.

## What to build
1. `git fetch origin main`, then merge origin/main INTO claude/p3-different-on-n-dates (a merge commit, not a rebase, not a force push).
2. Resolve DetailsScreen.tsx and PricesScreen.tsx keeping BOTH behaviours: all of #1346 (the this-date-only / all-dates prompt, its copy and state) AND the "Different on N dates" lines. Where #1346 already shows a count of dates affected, do not show a second competing number: the new line stays as the quiet note; say in the handover which wording you kept and why.
3. Run: `vitest run src/modules/organiser`, `npx tsc --noEmit -p .` (zero errors in touched files), `npm run check:mojibake`, `npm run check:integrity`. All of #1346's tests and the new differentDates tests must pass together.
4. Update the PR body only if a label line is wrong (keep the Verified on real data and Phone QA sections; both PR-body check scripts exit 0).
5. Push once; last commit subject ends `[worker-done <ticket>]`.

Branch: claude/p3-different-on-n-dates
Model / lane: Sonnet, normal lane.
