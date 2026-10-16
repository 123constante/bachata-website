# Brief: merge slices 3a+3d and 3c into the account-system branch (Website PR #775)

Repo `123constante/bachata-website`. You are the ONLY writer of `claude/account-grid` (PR #775, expected head b58f39d;
if it differs STOP and report). Merge, do not rebase, do not squash.

## Do
1. `git fetch origin claude/account-grid claude/account-grid-3ad claude/account-grid-3c`, check out `claude/account-grid`.
2. `git merge --no-ff origin/claude/account-grid-3ad` (expected 0520f11), then `git merge --no-ff origin/claude/account-grid-3c`
   (expected 41d0472). If either head differs from expected, STOP and report.
3. Expected conflict: `src/pages/AuthCallback.tsx` - both slices edit it. Keep BOTH behaviours:
   3a+3d's deletion check (`signInDeletionTarget()` right after the self-claim, before any returnTo or profile read)
   runs FIRST; 3c's `void acceptTerms()` for `mode=signup` (not awaited, own timeout) stays. A deleted account must go
   to restore before anything else. Resolve other conflicts by keeping both sides' intent; write each resolution in the
   merge commit message.
4. Cross-slice check: 3c stores the code-box state in a sessionStorage key (see `docs/handover/account-grid-3c.md`).
   3a's sign-out clears person-scoped keys (D1). If that key is not cleared on sign-out, add it to the clear list +
   a test (red before, green after). This is the ONLY code you may add.
5. Run on the merged head: `npm run build` (production), `check:bundle-budget`, `check:first-load-requests`,
   `npm run lint`, `npm run typecheck` (compare error count with b58f39d; no new errors in changed files),
   `npx vitest run --pool=forks` (never `git stash` mid-run; list failures vs the base's known set), `check:journey-grid`,
   `npx playwright test -c playwright.build.config.ts tests/e2e-build/account-delete.build.spec.ts tests/e2e-build/auth-consent.build.spec.ts`,
   `npx playwright test tests/e2e/account-settings.spec.ts`.
6. Write `docs/handover/account-grid-merge-3ad-3c.md`: merge SHAs, conflicts + resolutions, the step-4 result, a
   command/exit table, Verified / Not verified. Commit it, push `claude/account-grid` (the repo's pre-push hook runs;
   never `--no-verify`; if it fails, fix only what the merge broke, or STOP and report).

## Rules
Plain git only, never `gh api`. Supabase READ-ONLY. Never merge a PR / approve / `--no-verify`. Shell commands without
variables, loops or `$(...)` where a plain command works. Final commit subject ending `[worker-done <ticket>]`. At 25%
context start nothing new; by 30% push `PARTIAL [worker-done <ticket>]` with a "left" list. Start long runs in the
background early and keep your own reading small.
