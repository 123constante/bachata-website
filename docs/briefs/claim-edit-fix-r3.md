# Brief: claim-edit-fix-r3 (WEBSITE, normal lane, Sonnet). Branch claude/claim-edit-fix-r1 (PR #1244). One push.

Context line: stay under 35% of your context; at 45% start nothing new; push + handover by 50%. Never merge/approve/--no-verify. Plain git only. Supabase READ-ONLY. NO database changes.

## Problem
PR #1244 now conflicts with main in src/modules/organiser/p3/screens/DetailsScreen.tsx and EventPage.tsx. Main already merged #1229 "series Pictures row on Details (default_gallery)" and #1234 (Pictures sheet walk), which does the same job as our new "Photos" field.

## Do
1. `git fetch origin main` and merge origin/main into the branch (merge, not rebase; no force push).
2. Resolve: KEEP main's Pictures row and sheet as the one way to set photos for every date; DROP our Photos field, `addPics`/`pics` state and their tests/copy (the review findings F1-F4 about uploads then no longer apply; keep any fix that still applies to main's Pictures row only if a failing test shows the defect). KEEP from our branch: edit rows above Sessions and Coming up (EventPage), Details order (name, about, cover photo, Pictures, ticket link, then "More details"), one-date wording "Save" / "Saved." (also zero dates). Use the word main uses ("Pictures") everywhere on screen; one word for one thing.
3. Update tests and snapshots deliberately; table-driven matrix stays green (weekly 30, weekly 16, one-off 1 and 2 dates, draft, ended, with/without sessions).
4. Run every applicable CI job step (read .github/workflows). Fill the PR #1244 body again: guard lines exactly `- Shapes surveyed:`, `- Checks run:`, `- NOT verified:` and `## Phone QA`; say Photos field was dropped because main has Pictures.
5. Files over 2 KB: scripts/safe-edit.py. Entities (&mdash; etc.).

## Done = pushed, handover note, head SHA, per-job check table. Final commit subject ends [worker-done <ticket>].
