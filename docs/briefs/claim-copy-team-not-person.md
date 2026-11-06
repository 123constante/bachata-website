# Brief: Claim screen words say "the team", never a named person; fix "already has an owner"

Brief-version: 2
Repo: Website. Branch: claude/claim-copy-team-not-person. Lane: normal, Sonnet. No database call added.

Overlap note: PR #1411 (claude/claim-sheet-honest-retry) edits OnboardingFlow.tsx only. Keep your files to claimStates.ts, shared/copy.ts and their tests so there is no overlap.

## What main lacks
- A "no email" line that names a person: `NO_EMAIL_COPY` says 'This page has no email on file yet. Ask to join and Ricky approves it, usually the same day.' (src/modules/organiser/home/onboarding/claimStates.ts line 28). Replace with the Bachata Calendar team wording -- grep: team will check
- A "has a team" title that claims an owner: the `managed` screen (6b) title is `<name> already has an owner` (claimStates.ts line 48), but the database hint `managed` only means the page has members; the client cannot tell managers-only from owned (`ClaimHint` in shared/claimHint.ts has no owner flag and this brief adds no database call) -- grep: already has a team
- A second organiser-facing line that names a person: `WARN_END = 'Only Ricky can reopen an ended event.'` (src/modules/organiser/shared/copy.ts line 11), shown by flows/event/EndStep.tsx and pinned in shared/__tests__/copy.test.ts line 29. Reword to the team -- grep: Only the Bachata Calendar team can reopen
- A table test over every claim state's words that fails on any named person -- src/modules/organiser/home/__tests__/ClaimWords.matrix.test.tsx
- Already on main, keep: the single hint-to-words map (row, title, sub, primary per hint), `askedToJoinDone`, the `CLAIM_HINTS` coverage -- extends: src/modules/organiser/home/onboarding/claimStates.ts

## Files
src/modules/organiser/home/onboarding/claimStates.ts, src/modules/organiser/shared/copy.ts, src/modules/organiser/home/__tests__/ClaimStates.test.tsx (line 95 pins the old 6b title), src/modules/organiser/home/__tests__/Door.test.tsx (line 74 pins NO_EMAIL_COPY), src/modules/organiser/shared/__tests__/copy.test.ts (line 29), src/modules/organiser/events/__tests__/s5.events.test.tsx (imports WARN_END, should need no change), src/modules/organiser/home/__tests__/ClaimWords.matrix.test.tsx (new), docs/design/claim-copy-team-not-person.md (new design record, copy only).
Leave alone: src/modules/admin-organisers/** (it says "Ricky" to the operator, a different audience). Before editing re-run `git grep -n -i "ricky" origin/main -- src ':!*test*'` and report any new organiser-facing hit you find.

## What to build
1. `NO_EMAIL_COPY` -> a short British-English line with no person, for example 'This page has no email on file yet. Ask to join and the Bachata Calendar team will check and get back to you.' The lead decides the exact words; no "usually the same day" promise.
2. `managed` title -> neutral `${name} already has a team`; sub stays 'You can ask to join the team.' Say in the PR body why: the hint cannot separate owned from managers-only, so "owner" was a claim the screen could not back.
3. `WARN_END` -> 'Only the Bachata Calendar team can reopen an ended event.' and update its pins.
4. Table test, RED FIRST (new rows fail on unchanged code): for each of `CLAIM_HINTS` plus null (unknown), assert `claimScreen(...)` title, sub, `hintRowText` row and primary label contain no "Ricky", no person's name, and no "owner" except the 'yours' state ("You are already its owner" stays true). Also assert the `askedToJoinDone` strings, `NO_EMAIL_COPY` and `WARN_END`. Update the existing pins.
5. Design record docs/design/claim-copy-team-not-person.md (copy only): brief, ONE chosen wording with why, two rejected wordings in two lines each.

## Out of scope
No database call, no change to hints, to OnboardingFlow.tsx or to who may claim. Walk the claim sheet at 390x844 for every hint state (text-length check, no layout change expected).
Hand-off: Verified / Not verified block, design record linked in the PR body.
