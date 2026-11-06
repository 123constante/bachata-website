# Brief: walk judge daily budget check (hold and alert, never pass anyway)
Brief-version: 2
Branch: claude/walk-judge-daily-budget
Lane: careful, Opus. 123constante/bachata-website, new scripts/lib/walk-judge-budget.mjs, its test and the judge spec only; no workflow, no package.json, no src/**, nothing is armed or dispatched.
Serves: the owner and lead (a runaway judge loop cannot burn more than 8 dispatches or 3 hours a day, and over budget never reads as a pass).

## What main lacks
- JUDGE_CONFIG.budget names the daily ceilings (3 runtime hours, 8 dispatches, 15 minute walk limit, action hold-and-alert) but nothing enforces them; the spec says "enforced in Part B". A pure decision function is missing -- grep: judgeBudgetDecision
- extends: the spec table row dailyTotalEnforcedIn still says part-b and the Residual risks section says the ceilings are not enforced -- docs/automation/judge-worker.md

## Files
scripts/lib/walk-judge-budget.mjs (new)
tests/walkJudgeBudget.test.ts (new)
scripts/lib/walk-judge.mjs
docs/automation/judge-worker.md

## What to build
1. New pure module `scripts/lib/walk-judge-budget.mjs` exporting `judgeBudgetDecision(ledger, now, config = JUDGE_CONFIG.budget)`. `ledger` is an array of `{ startedAt, endedAt|null, branch }` ISO strings; `now` is an ISO string passed in (no clock, no fs, no network, no env). It counts the UTC day of `now`. Returns `{ allow: boolean, action: 'allow'|'hold-and-alert', reasons: string[], dispatchesToday, runtimeHoursToday }`. An open entry (endedAt null) counts as running until `now`.
2. Hold-and-alert (`allow: false`) when dispatchesToday >= judgeDispatchesPerDay, or runtimeHoursToday >= judgeRuntimeHoursPerDay, or a single open entry has run longer than walkWallLimitMinutes. Fail closed: a malformed ledger, a non-ISO or future-dated entry, an entry with endedAt before startedAt, a missing `now`, or any thrown error returns `allow: false` with a reason; the function never throws and never returns allow on doubt.
3. Edge handling: entries that straddle midnight UTC count only their minutes inside today; an empty ledger allows; exactly 8 dispatches holds (the ninth would be refused, the eighth allowed only if seven are recorded).
4. Update the spec and `JUDGE_CONFIG.budget.dailyTotalEnforcedIn` to name the new module (the spec/module constant tables must still compare equal both ways in tests/walkJudge.test.ts), and say in the PR body that Part D's dispatcher must call it before every judge dispatch; nothing here wires that.

## Tests
Table-driven vitest in tests/walkJudgeBudget.test.ts, red first (the module does not exist): rows for empty ledger, 7 / 8 / 9 dispatches, 2h59 / 3h00 runtime, open entry over 15 minutes, midnight straddle, future-dated entry, endedAt before startedAt, non-array ledger, missing now, config with a non-number ceiling. Add at least four mutants (change >= to >, drop the straddle clamp, allow on throw, ignore open entries) and show each turns the suite red. Existing tests/walkJudge.test.ts stays green.

## Done when
- All rows pass, mutants killed, tests/walkJudge.test.ts green, `npm run lint` link for scripts green (check-script-conventions passes unchanged).
- PR body has a Verified / Not verified block: Verified = unit tests and mutants; Not verified = any real dispatcher wiring, any real ledger (none exists yet).
- No file outside the list above changed.
