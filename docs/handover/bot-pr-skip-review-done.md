# Handover: bot-pr skip review/done + stale bot-PR sweep (dt_39a6cac5d10a)

Done (branch `claude/bot-pr-skip-review-done`):
- `bot-pr.yml` job `if:` skips `claude/review-*` and `claude/done-*` (dash included). `tests/botPrSkip.test.ts`
  evaluates the REAL expression with a subset evaluator; red on unfixed main (3 review/done rows); mutants M1-M6 in-test.
- `scripts/lib/stale-bot-pr.mjs` (pure `decide`/`plan`, `PROTECTED_LABELS`, `MAX_CLOSES=5`, `STALE_DAYS=3`),
  `scripts/sweep-stale-bot-prs.mjs` (dry-run unless `--apply`), `.github/workflows/stale-bot-pr-sweep.yml`
  (daily 04:23 UTC + dispatch, pause reader first, fail closed), registered as a pause consumer.
- Review round 1 (CI-guard stopping rule: one round): 5 correctness findings fixed (report never supersedes work;
  superseder never closed in the same run; failed close takes its comment back; autopilot hands-off labels protected;
  symmetric ticket keys). Each has a table row or in-test mutant.

Deliberate deviations / open:
- Drafts are never swept (conservative reading of "not draft-protected").
- `pull-requests: write` on GITHUB_TOKEN is unused (closes use BOT_PR_TOKEN) but kept because the brief pins it.
- Live drill (probe branches) NOT run: one-push rule; drill is by table test.
- First scheduled run: owner should check the run log (one line per decision) before trusting it.

## Fix round r1 (brief/fix-1368-r1, dt_5d7170e402db)

Done:
- `scripts/sweep-stale-bot-prs.mjs` added to TARGETS in `scripts/prove-entry-point-dispatch.mjs` (the red
  `integrity` step "Entry-point dispatch proof"); every `integrity` step run locally, all exit 0.
- `stale-bot-pr-sweep.yml`: `workflow_dispatch` input `apply` (boolean, default false). Schedule -> `--apply`;
  manual run -> dry run unless `apply` is ticked (`SWEEP_APPLY` env, pinned by test). To try it by hand:
  Actions -> Stale bot-PR sweep -> Run workflow, leave `apply` unticked, read the log.
- `decide()` never closes a PR with an owner APPROVED review on its current head sha, or with any hard-tier
  path (pack `HARD_RULES` or review-scope `isRiskyPath`, the merge lane's test, so `src/` counts). The runner
  reads `/files` and `/reviews`; a file list that is not exactly `changed_files` long is "not read" -> kept.
- Tests: trigger set pinned to exactly {schedule, workflow_dispatch}; survivor rows S3, L5, L6/R7, R2, R3,
  R5, R6 (comments and commits), R9; approve/hard-tier rows and mutants. Red first: 15 failing before the fix.

Deviation for the owner: "hard-tier" uses the merge lane's union (includes `src/` via isRiskyPath), so
superseded app-code PRs are never swept; only docs/tests/public-only bot PRs are. Narrow to pack
`hardTier()` only if the owner wants app PRs swept.

Left / next: the sweep stays disarmed until the owner decides (no automerge-ok label). Live drill not run.
