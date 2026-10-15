# Brief: account system (Website) - grid gate INTEGRATION (slice group PR-1 finish)

Repo `123constante/bachata-website`. Read FIRST on branch `arc/briefs-dancer-rebuild`: `briefs/dancer-rebuild-COMMON.md`
(hard limits, CI without billing, definition of done, handover, 30% context rule) and `briefs/account-grid-pr1.md`
(the slice-1a/1b brief this finishes).

Plain git only, never `gh api`. Commands without variables, loops or `$(...)` where a plain command works. Check a
PRODUCTION build (`npm run build`), not only the dev server.

## Owner decision (2026-10-15, binding)
The whole Website side of the account system ships as ONE PR. Your branch `claude/account-grid` IS that PR's branch.
Later slice groups (sign-in/settings/delete, invite, e-mail journeys, hardening) will be merged into it by the
orchestrator later; you only do the grid-gate part. The PR title: `feat(account): account system (Website)`. The PR
body says it is one PR in progress: section "Done: grid gate" (yours) and "Still to come: sign-in, sign-out, settings,
delete/restore, dancer invite, e-mail code journeys, hardening". It must NOT be merged yet; say so on line 2.

## Task
1. Create `claude/account-grid` from `origin/main`. `git merge origin/claude/account-grid-1a` then
   `git merge origin/claude/account-grid-1b` (no shared files; if a conflict appears, resolve it and say how).
2. Read `docs/review-packs/account-grid/HANDOVER-1b.md` and `BASELINE-PROPOSAL.md` (from 1b).
3. Run `node scripts/check-journey-grid.mjs --write-baseline` once; the baseline must list exactly the gaps in
   BASELINE-PROPOSAL.md. Explain any difference in the handover. Every baseline entry carries a reason.
4. Make the link HARD: 1a's "grid file absent -> SKIP" becomes exit 1 (the grid file now exists). Add a self-test case
   for it and prove it red-first (rolled-back mutant: restore the SKIP, the self-test must fail).
5. Run EVERY CI job step from `.github/workflows/*` in your sandbox (lint chain incl. the new check, tsc, vitest,
   `npm run build`, the build-spec Playwright config). Per-job table (command, exit code) into the PR body and the
   handover. Billing rule from COMMON applies.
6. PR body sections: Phone QA = "no UI change in this part"; real-data section = which prod shapes the grid rows
   reference (counts only, read-only via Supabase MCP if needed); Verified / Not verified.
7. Push. `bot-pr.yml` auto-opens the PR as the bot. Write `docs/review-packs/account-grid/HANDOVER-integration.md`
   (done / left / next) and finish with the done marker per COMMON.

## Do not
Touch `src/` behaviour, add new journey rows, or start any later slice group. Never merge or approve. Stop after the
push and the handover.
