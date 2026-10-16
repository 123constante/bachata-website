# Brief: #775 one-line fix after merging #762 (Website, branch claude/account-grid)

## What and why
PR #775 (branch `claude/account-grid`, head d90e8d0) was merged with main after #762 (/privacy, /terms) landed.
The merge added `src/pages/legal/LegalShell.tsx`, which spells the mailbox itself:
`const CONTACT_EMAIL = 'support@bachatacalendar.co.uk';` (line 33).
#775's test `src/lib/__tests__/accountReviewRound1.test.ts` > "S1: one contact address" > "no other source file spells a
bachatacalendar.co.uk mailbox" now FAILS on GitHub (unit (Europe/London, full)), naming that file. The rule is
right (owner decision: ONE contact address, one constant). Fix the source, NOT the test.

## The task (exactly this)
1. In `src/pages/legal/LegalShell.tsx` replace line 33 with an import of the shared constant:
   `import { ACCOUNT_CONTACT_EMAIL as CONTACT_EMAIL } from '@/lib/accountDeletionCopy';` placed with the other imports
   (delete the old `const CONTACT_EMAIL = ...` line). Nothing else in the file changes; the rendered text stays identical.
2. Red-first: run `npx vitest run src/lib/__tests__/accountReviewRound1.test.ts` BEFORE the edit (S1 must fail naming
   pages/legal/LegalShell.tsx) and AFTER (all pass). Also run the legal tests: `npx vitest run src/pages/legal` and any
   `__tests__` that import LegalShell, Privacy or Terms (grep for them) - all pass.
3. Run the CI job steps that a source edit can affect (read .github/workflows): typecheck count must equal the base,
   eslint on the file, `npm run build`. Put command + exit code in the PR comment.
4. Commit on `claude/account-grid`, push with PLAIN git, then post ONE PR comment on #775 with the red-first proof and
   the table, as the bot (`GH_TOKEN` = GH_BOT_TOKEN), via `gh pr comment 775 --body-file <file>`.

## Known and NOT yours
The same job also fails on `src/modules/organiser/dates/__tests__/DatePage.test.tsx` (+ levelsByType). That is date
drift on main (fails on main 070c320 too). Do not touch organiser files.

## Boundaries
Never merge or approve. Never `--no-verify`. Supabase read-only. Read and push with plain git (git fetch / git show /
git push), never `gh api`. Shell commands without variables, loops or `$(...)` where a plain command works.
Touch only `src/pages/legal/LegalShell.tsx`. Stop after the push + comment.
