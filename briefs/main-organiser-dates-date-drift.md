# Brief: fix main's date-drift red in organiser dates tests (Website, new branch off main)

## What and why
The REQUIRED check `unit (Europe/London, full)` is red on main (28693be) and on every Website PR, so nothing can merge
(ruleset "main checks", no bypass). It blocks #775 (account system), whose delete button on prod waits on it.
Cause: `src/modules/organiser/dates/__tests__/DatePage.test.tsx` line 24 `const DATE = '2026-10-15'` and
`src/modules/organiser/dates/__tests__/levelsByType.matrix.test.tsx` line 29 `const DATE = '2026-10-15'` are fixed
dates. Since 2026-10-16 they are in the PAST, so the date page no longer renders
`[data-testid="date-preview-bar-action"]` and many tests fail with "Unable to find an element by:
[data-testid="date-preview-bar-action"]". Green 2026-10-15 21:19Z, red 2026-10-16.

## The task (exactly this)
1. Branch `claude/fix-organiser-dates-date-drift` from `origin/main`.
2. In BOTH test files freeze the clock so DATE is always in the future, the class fix (no new hard-coded "today"):
   `vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));` in a `beforeAll`
   (or the file's existing setup), restored with `vi.useRealTimers()` in `afterAll`. Only fake `Date` so promises and
   timers keep working. Keep DATE as is. Check the "never Tonight" comment still holds (2026-10-01 is not 10-15).
   If a test in these files needs real "today" behaviour, choose the frozen time per describe instead; explain it.
3. Prove it: `TZ=Europe/London npx vitest run src/modules/organiser/dates` -> all pass. Also red-first: with the
   freeze removed the same tests fail (paste the count). Run the whole `unit (Europe/London, full)` job command from
   .github/workflows (read it) and report: the only acceptable failures are ones that also fail on main for reasons
   other than this drift; list them.
4. Open a PR as the bot (`GH_TOKEN`=GH_BOT_TOKEN, `gh pr create`), title
   "test(organiser): freeze the clock in dates tests (main date-drift red)", body with the proof and a per-job table.

## Not yours
Touch ONLY those two test files. No product code. Another session (website-ce) owns organiser features; this is a
test-clock fix only.

## Boundaries
Never merge or approve. Never `--no-verify`. Supabase read-only. Read and push with plain git, never `gh api`.
Shell commands without variables, loops or `$(...)` where a plain command works. Stop after the PR opens.
