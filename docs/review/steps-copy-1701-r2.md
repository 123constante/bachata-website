# Review of PR #1701: price-steps editor copy and stale errors

Independent read-only review (fresh subagent, did not write the code). Reviewed head 2ba8718 of `claude/steps-copy-owner-course`.

## Verdict: PASS WITH NITS

Round 1 at head 6d711d4 was BLOCK: `isCourse` read `form.kind`, which is empty for a saved course. Fixed in 2ba8718 (reads `courseRead.data?.kind`), plus a test on the saved-course path. This round re-read the full diff at 2ba8718.

## Findings
1. NIT, CONFIRMED. `courseRead` only runs when both course flags are on. While it loads, fails, or with the presets flag off, a saved course's step says "every night of this ticket". Courses are only created with the presets flag on, so the flag-off case is moot; the loading flash is brief.
2. NIT, PLAUSIBLE. The new test asserts right after `editor()` without a `waitFor` on the course read; it could race. It fails correctly if the fix is reverted.
3. OK. `at` and `price` match `StepErrors`; editing one field leaves the other's error; `save()` replaces the whole errors state.
4. OK. `appliesLine` and `PriceSteps` have one caller each; default `course=false` keeps the old copy.
5. NIT. "Only the owner or an admin of this organiser can change prices." is plain; "admin" is mild jargon.

No money path, no migration, no RLS or guard change. Not hard tier.
