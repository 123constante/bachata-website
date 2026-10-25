# Rebase handover -- account + journey-grid arc (ticket dt_a73ba72755b0)

Brief: `brief/people-arc:briefs/REBASE-account-arc-brief.md` (blob 0761479e). Main at start: `ced69f2`.

## Result: all five PRs LEFT UNTOUCHED -- main already contains them

Every commit on all five branches was squash-merged into main on 2026-10-16 as
**#775 `ecc3432e` "feat(account): account system (Website)"**. Its squash message lists
each commit by subject (1a `97ff59e0`, 1b `7e722c24`, 3c `dd1fe33c` + `41d04725`,
3ad `1e2dfb03` + `0520f114`, 3b `9eedb90b`), plus five later integration commits
(S1/S2 wiring tests, notes.tsx restore, LegalShell constant, snapshot cleanup).

Brief step 3 applies ("main has already replaced what the PR builds"): no rebase, no
tag, no push on any PR branch. A rebase would drop every commit as already-applied, or
leave a diff whose only content REVERTS #775's integration fixes and the 77 main commits
since -- the opposite of each PR's meaning.

How I proved it: for each branch, I diffed the branch tip against `ecc3432e`, limited to
the files the branch touches. Every remaining line is a later integration change
inside #775, not PR work that is missing from main. Examples:
- 3ad `src/lib/accountDeletion.ts`: #775 moved `ACCOUNT_RESTORE_PATH`/`restorePathFor`
  into `lib/accountRouting` and re-exports them from here.
- 3b/3c `notes.tsx`: #775 put back main's dancer-app comment on purpose
  ("restore dancer-app notes.tsx").
- 1a/1b grid json/baseline: #775 has the HARD-gate baseline and grid rows, which are
  newer than these branches.

| PR | branch | old head (unchanged) | new head | status | conflicting files vs main (merge-tree) |
|---|---|---|---|---|---|
| #772 | claude/account-grid-1a | 97ff59e08282 | -- | LEFT UNTOUCHED (in main via #775) | package.json, scripts/__tests__/check-journey-grid.test.mjs, scripts/check-journey-grid.mjs, scripts/journey-grid-baseline.json, scripts/run-lint-chain.mjs |
| #773 | claude/account-grid-1b | 7e722c245f06 | -- | LEFT UNTOUCHED (in main via #775) | docs/account-system/{DECISIONS.md,JOURNEY-GRID.md,journey-grid.json} |
| #777 | claude/account-grid-3c | 41d0472517bb | -- | LEFT UNTOUCHED (in main via #775) | 21 files (grid docs, baseline, pre-ship, lint-chain, auth screens/tests, shots-3c) |
| #776 | claude/account-grid-3ad | 0520f114a9f3 | -- | LEFT UNTOUCHED (in main via #775) | 29 files (grid docs, account deletion lib/pages/tests, AuthCallback, useAuth, shots-3ad) |
| #780 | claude/account-grid-3b | 9eedb90ba134 | -- | LEFT UNTOUCHED (in main via #775) | 43 files (union of 3c + 3ad plus accountGate test, accountRouting, auth snapshot) |

All five are still open on GitHub with `mergeable_state: dirty` (checked #772 and #780 directly).
None touches `.github/workflows` or `supabase/**`.

## Owner action needed
These five PRs are superseded duplicates of merged #775. The owner rule is "nothing
closed", so I closed nothing. Closing them by hand (as "merged via #775") is the only
way to clear the PR Mergeable Guard for this arc. Rebasing cannot do it without
changing what the PRs mean.

## Tests run
None. No code changed, so there was nothing to test.

## Not verified
- I did not open #773, #776 or #777 on GitHub. Their open/dirty state comes from the
  brief and from git, not from a live check.
- I did not re-run the PR Mergeable Guard.
