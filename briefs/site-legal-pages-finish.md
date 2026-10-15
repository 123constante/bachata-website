# Brief: finish PR #762 (/privacy, /terms) so every check is green

Repo: 123constante/bachata-website. Branch: `claude/site-legal-pages` (PR #762, head db7b3288). Push to it only.
Read first: `docs/review-packs/site-legal-pages/HANDOVER.md` and `docs/handover/site-legal-pages.md` on the branch.
The legal content and owner values are DONE; do not change wording.

## What is red on db7b3288 and what to do
1. `dancer-area-isolation` (unit-tests.yml, run 38758237685): "dancer-area isolation: 11 violation(s)".
   `git merge origin/main` first (plain git), then run the isolation check script that job runs (read
   `.github/workflows/unit-tests.yml` for the exact command) and fix each violation the smallest way the script's
   rules allow (usually: route the import through the allowed seam, not an allowlist entry). If a violation is in
   a file this PR does not touch and is also red on main, say so instead of fixing it.
2. `phone-qa-section` FAIL: PR body lacks "## Phone QA". 3. `real-data-verified` FAIL: body lacks
   "## Verified on real data". Read `scripts/check-pr-phone-qa.mjs`, `.github/workflows/real-data-verified.yml`
   and `.github/pull_request_template.md` for the exact required lines, then write the PR body as
   `docs/review-packs/site-legal-pages/PR-BODY.md` on the branch: first line = PR title
   (`feat(site): /privacy and /terms pages, footer links, version constants`), then the body: what changed, the
   per-job table, both required sections filled with REAL content (sizes checked with WxH = 390x844 production-build
   walk; real data = the pages are static, say what was checked), Verified / Not verified. The orchestrator copies
   that file into the PR body. Make it pass both check scripts run locally against the file (the scripts take the
   body text; read how).

## Gates (CI without paying GitHub)
Billing annotations ("payments have failed / spending limit") are not code failures. Run every pull_request job
step in `.github/workflows/` your sandbox can run (typecheck, unit tests incl. the timezone runs, isolation,
integrity, `npm run build` PRODUCTION build) and put the per-job table (command, exit) in PR-BODY.md. Say what you
could not run.

## Rules
- Plain git for read and push. NEVER `gh api`, never `gh pr edit`.
- Shell commands without variables, loops or `$(...)` where a plain command works.
- Never merge or approve. Never `--no-verify`. Supabase read-only.
- Context: at 25% start nothing new; by 30% push + handover with `PARTIAL [worker-done <ticket>]`.

## Output
Last push carries `[worker-done <ticket>]`; report the head SHA and the per-job table.
