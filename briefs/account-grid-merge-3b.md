# Brief: finish slice 3b and merge it into the account-system branch (Website PR #775)

Repo `123constante/bachata-website`. You are the ONLY writer of `claude/account-grid` (PR #775, expected head
c30e9d3; if it differs STOP and report). Merge, do not rebase, do not squash. Do not touch `claude/account-grid-3b`.

## Steps
1. `git merge --no-ff origin/claude/account-grid-3b` (expected head 9eedb90). No conflicts expected; resolve any, and
   list each in the handover.
2. Review fixes from `docs/review-packs/account-grid/REVIEW-3B.md` on branch `claude/account-grid-3b-review` (read it):
   - S1: a hook-level test that renders the REAL `useProfileSides` (or `ContinueAsScreen` with the real hook) with
     `my_account_deletion_status_v1` returning pending / expired / still-loading, asserting `deletion: 'restore'` /
     `'deleted-card'`, the navigation to `/account/restore`, and `continue-as-loading` while pending.
   - S2: direct table rows for the exported pure `composeAccountGate`: completion loading + deletion restore -> deleted;
     completion loading + deleted-card -> deleted; completion error + restore -> deleted; complete + deletion loading ->
     loading; signed-out + anything -> signed-out.
   - Mutation proof for both (quote in the handover): remove the `deletion` line at `useProfileSides.ts:72` -> S1 test
     fails; swap the deleted/loading branches in `composeAccountGate` -> S2 rows fail. Restore the code after.
   - S3 (decided by the orchestrator for the owner, may be overruled in the review pack): D4 means "a finished dancer is
     never sent back into setup". A 100% dancer on `/app/welcome` goes straight on; 70-99% sees the end card. Record
     this in `docs/account-system/DECISIONS.md` under D4 with that sentence and "changing it needs a dancer-app-only PR".
3. **Dancer-area isolation fix (the PR's CI is red on it):** the PR changes ONE dancer-app file,
   `src/modules/dancer-app/screens/onboarding/notes.tsx` (a comment-only rewrite from slice 3c), which makes CI treat
   the PR as a dancer-area PR and fail 48 files. Restore it byte-for-byte: `git checkout origin/main -- src/modules/dancer-app/screens/onboarding/notes.tsx`.
   Then `git diff --name-only origin/main...HEAD` must list NO file under `src/modules/dancer-app/`, and
   `npm run check:dancer-area-isolation` must exit 0 (quote its mode line). Note in the handover: the comment update
   goes in a later dancer-app-only PR.
4. Run every CI job step you can: `npm run build` (production), `check:bundle-budget`, `check:first-load-requests`,
   `typecheck` (compare count with base c30e9d3 = 96), `npx eslint` on changed files, `bash bin/check-integrity.sh`,
   `npm run lint`, `check:journey-grid`, `check:dancer-area-isolation`, `vitest run --pool=forks` (name every failure
   and whether it fails on c30e9d3 too), playwright build specs for account-delete, auth-consent, account-settings,
   public-journeys. Never `git stash` mid-run.
5. Handover `docs/handover/account-grid-merge-3b.md`: merge result, fixes table, mutation proofs, command + exit code
   table, Verified / Not verified. Commit, push `claude/account-grid`.

## Rules
Plain git only (`git fetch`, `git show`, `git push`), never `gh api`. Supabase READ-ONLY. Never merge a PR, approve,
or `--no-verify`. Shell commands without variables, loops or `$(...)` where a plain command works. Never touch
`src/modules/organiser/**` or `src/modules/dancer-app/**` (except the step-3 restore). Push once at the end, subject
ending `[worker-done <ticket>]`. At 25% context start nothing new; by 30% push `PARTIAL [worker-done <ticket>]`.
