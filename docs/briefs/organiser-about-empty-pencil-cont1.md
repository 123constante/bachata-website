# Brief: organiser-about-empty-pencil continuation 1 (fix the red unit check on PR #1473)
Brief-version: 2
Branch: claude/organiser-about-empty-pencil
Lane: normal, Opus. Repo 123constante/bachata-website. Same PR (#1473), same branch. Continuation: read the previous handover on the branch first. Screen change, no migration, no hard-tier path.

## Goal
PR #1473 puts the About pencil on the empty About line. Its unit CI is red: `visibility.matrix` "owner-blank ... a pencil opens the About sheet" (4 cases, `Unable to find button "Edit about"`). Cause: the first round made `slot('about')` return null when no bio shows, but the blank-page "Add a bio" pill added by PR #1471 (now merged) renders through `slot('about')` with no bio. Fix without breaking that pill.

## What main lacks
- A pencil on the empty About line that does not remove the blank-page About pencil from #1471 -- grep: aboutEmptyPencil

## Files
- src/modules/organiser/edit-in-place/parts.tsx (exists on the PR branch)
- src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx (exists on the PR branch)
- src/modules/organiser/edit-in-place/__tests__/aboutEmpty.matrix.test.tsx (new, exists on the PR branch)
- docs/design/organiser-about-empty-pencil.md (new, exists on the PR branch)

## What to build
1. Merge or rebase onto current origin/main first (#1469, #1471 are now on main). Re-read what #1471 changed in `src/pages/OrganiserProfile.tsx` and the layer: the blank-page empty state uses `slot('about')` when there is no bio and it must keep rendering its pencil.
2. Keep `slot('about')` rendering the pencil when there is no bio, as on main. Solve the double pencil on the public page (two About pencils when the empty line and the pill both show) another way. Pick ONE and record why plus the rejected one in two lines each in the design record: (a) the `about-empty` case renders the sentence with no second pencil when `'about'` is also rendered on that screen; or (b) the public page renders only one of about / about-empty. Do NOT edit `src/pages/OrganiserProfile.tsx` unless the only fix is there; if so say why in the handover.
3. Tests: keep the round-1 matrix; add rows for the blank-page state (no bio, no events) with exactly ONE About pencil, and the public page with no bio plus events with exactly ONE About pencil. Run red first against the broken round-1 head for the new rows and say so.
4. Before the push run locally: `npx vitest run src/modules/organiser/edit-in-place src/modules/profile src/pages` (the visibility.matrix file is in here), `npx tsc --noEmit -p .` 0 errors in touched files, `npm run check:mojibake`. Put the per-job table in the PR body. Edit body labels exactly: "## Verified on real data" (Shapes surveyed / Checks run / NOT verified) and "## Phone QA" (Sizes checked / Walked / Not verified). Walk 390x844 both states and say which pictures you looked at.
5. Push once, last commit subject ending [worker-done dt_<your ticket>].

## Do NOT touch
Calendar density files, src/components/ui/dialog.tsx, supabase/**, migrations, workflows, scripts/**, .env*, any file not listed under Files except a failing test that the change forces (name it in the handover).

## Done when
`visibility.matrix` and all organiser edit-in-place tests pass; exactly one About pencil in every state; PR #1473 CI green on the unit job.
