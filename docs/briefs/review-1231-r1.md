# Brief: review-1231-r1 (docs/review only; branch claude/review-1231-r1)

Independent review of Website PR #1231 (head 0ed11b2, branch claude/guard-p3-walk-specs), GUARD-CI, hard tier. You review; you change NO code on that branch. Your only push is one file, docs/review/pr-1231-r1.md, on claude/review-1231-r1.

Read: `git fetch origin claude/guard-p3-walk-specs` then `git diff origin/main...FETCH_HEAD`. Also the PR body (`gh pr view 1231` is allowed read-only if available; otherwise skip).

Question: does this PR do what it claims, and can its new guard fail OPEN?
1. scripts/check-p3-specs-not-skipped.mjs: try to construct a P3 spec skip that the guard still passes (skip inside a helper, early return, `test.fixme`, `test.describe.skip`, `test.skip()` with a truthy-when-flags-on conjunct, a spec list entry missing from test:e2e:p3, flag set to 'false' or in a different step). Run `--self-test`. Mutate the guard (drop a check) and confirm the self-test turns red; report any mutant that stays green.
2. e2e-smoke.yml: new step has `!cancelled()`; legacy step env unchanged; does the new step run on every PR that touches P3 paths? Any path filter that would let P3 specs go unrun?
3. package.json test:e2e vs test:e2e:p3: every P3 spec in exactly one list, none dropped from CI.
4. The 4 probe-skip edits and the pre-ship smokeEnvFrom change: any behaviour change for flags-off runs?
5. onboarding.css one-line colour fix: correct token, dark mode still readable.
6. The CLAUDE.md line added: accurate, within the 19 KB budget (`wc -c CLAUDE.md`).
Output: verdict PASS / PASS WITH NITS / BLOCK, findings numbered F1.. each with file:line and a concrete failing scenario, and an honest Verified / Not verified list. Commit subject ends `[worker-done <ticket>]`.
