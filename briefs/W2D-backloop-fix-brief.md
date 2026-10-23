# W2-D step 2: fix the Back loop on PR #963 (person-page only)

Repo 123constante/bachata-website. Branch `claude/w2d-hub-build` (PR #963, head 0d946700). You are the only worker on it.

## The bug (measured by the critique worker)
On a one-role person's dancer or DJ page, the role bar's "Back to <name>" goes to `/people/<slug>`. This PR 302s that
straight back to the same page, so Back loops (prod ids: `/dancers/unclaimed-00422bf9`, `/djs/bobby-blanco`). About 29
active people. Prod has `flags.personHub` ON, so #963 must not merge with the loop.

## The fix (already written: apply it, do not redesign)
`docs/handover/w2d-hub-back-loop.patch` on this branch. Apply ONLY its person-page hunks:

`git apply --exclude='src/modules/dancer-app/*' docs/handover/w2d-hub-back-loop.patch`

That changes `src/modules/person-page/roleSwitch.ts` (no hub = no bar, via `personDestination`) and
`src/modules/person-page/__tests__/roleSwitch.test.tsx`. Do NOT touch any file under `src/modules/dancer-app/`: that would
make #963 a dancer-area PR and red `check-dancer-area-isolation` rule (a). The matching dancer-area test change (dropping the
dancer-only row in `oneBack.test.tsx`) is a SEPARATE PR on `claude/oneback-no-hub-row` that merges before #963.

Expected and fine: on this branch alone, `src/modules/dancer-app/public-page/__tests__/oneBack.test.tsx` row 'one role'
fails until that separate PR is on main. Report it as "expected until claude/oneback-no-hub-row merges". Prove it: apply the
same one-row removal in your working tree only (never commit it), and show oneBack passes then.

## Also
- Red first: run the new roleSwitch tests against the unfixed `roleSwitch.ts` and report the fail count, then green.
- Walk on prod reads at 390x844 (reuse `docs/mockups/w2d-hub-build/walk.mjs`/`probe.mjs`): Back from `/dancers/unclaimed-00422bf9`
  and `/djs/bobby-blanco` (no bar, the page's own Back, no loop); a two-role person's role page still shows the bar and
  "Back to <name>" lands on the hub. Take screenshots and LOOK at them.
- Update `docs/handover/w2d-hub-build.md`: move the Back loop from "READ FIRST: blocker" to fixed (say how), and refresh the
  CI table and the ready-to-paste PR body (drop "Do not merge without it"; add that #963 merges after the oneBack PR).
  Update `docs/design/w2d-hub-build.md` if a number changed.
- `npm run build`, `node scripts/check-dancer-area-isolation.mjs` (must say "not a dancer-area PR"), and every CI job step.

## Push
ONE push. Last commit subject ends `[worker-done <ticket>]` (NOT [skip preview]).

## Two owner wording decisions (2026-10-23, owner picked both) -- person-page files only
1. Gig count only from 2: one upcoming gig reads "Next gig Friday 23 October" with NO "1 coming up"; 2+ keeps " &middot; N coming up"
   (N = total, as today). Where: `hub/model.ts` (nextGigOf / the line builder) and anything on the wall that prints the same count.
2. Gig date with the month and the FULL weekday (owner copy rule: "Friday", never "Fri"): "Friday 23 October". Change the ONE
   date label the wall and the hub share (`wallDateLabel`, wall/model.ts or wherever it lives) so both surfaces change together;
   London date, same day-rollover as today. Check the longer line still fits at 360px (no clipping, the reserved two-row line
   in the Also card still holds; re-measure the late-data shift, must stay 0).
Table-driven tests, red first, for both (0, 1, 2, 5 gigs; a date this month and next month). Update the design record numbers.
Do NOT touch the language codes ("es, en"): that is a separate dancer-area PR later.
