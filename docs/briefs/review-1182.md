# Review PR #1182 (read-only) - ticket review-1182

Repo 123constante/bachata-website, branch claude/p3-prefix-c-repeat-null (builder: Opus). You are the independent reviewer. Do NOT edit src, do NOT push to that branch, never merge or approve.

Output: ONE new file `docs/review/p3-prefix-c-r1.md` on your own branch `claude/review-1182-r1`, then push and stop. End your last commit message with `[worker-done review-1182]`.

## Question
PR #1182 makes a weekly series with no stored recurrence rule never read "Doesn't repeat" on the P3 event page Repeats row, the Repeat sheet and Skip. One mapping in `model/repeat.ts` (`repeatShape`, `repeatWords`, `noRuleNote`), read once by `data/dateFacts.ts` `repeatShapeOf`.

## Check
1. Every outcome of the mapping (rule / no-rule series / one date / unknown) x every screen that shows it: no screen keeps its own copy of the words.
2. No copy points at a control that is not on screen; disabled controls say why; an untouched save sends no command.
3. Real shapes: series with 13 weekly dates and NULL rule, ended recurring, cancelled dates, one date, zero dates, over 100 dates. Read-only SELECT counts on prod (project stsdtacfauprzrdebmzg) are allowed; no writes; counts only, no personal data.
4. Tests: do the new table-driven tests fail on the unfixed code (check out origin/main's repeat.ts and run them)?
5. Run the related vitest files and the module's whole test tree.

## Report
Verdict PASS / FIX FIRST / BLOCK, then numbered findings with file:line, severity, one-line fix each. State what you could not check. Stopping rule: one round; no fixes by you.
