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
