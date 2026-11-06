# Brief: Website auto-merge classifier = exactly classes A, B, C

Brief-version: 2
Repo: Website (123constante/Website). Branch: claude/automerge-web-classes-abc. Lane: careful, Opus. HARD TIER (touches scripts/ and the tests of a guard): owner Approve at the final head is required, then merge. Do not change repo variables, secrets, arming.json or the workflow file.

## What main lacks
- A class-A/B path rule: `pathClass` returns "docs" for ANY file under `docs/` (so `docs/x.mjs`, `docs/x.json`, `docs/x.sql` qualify); only lowercase .md/png/jpg/jpeg/webp/gif under `docs/` plus root `README.md` should -- grep: isClassAB
- A file-count cap (class file: max 60 files); today only the 400-line cap exists, and class C must be under 200 lines -- grep: MAX_CHANGED_FILES
- A class-C narrowing: today `e2e/`, `**/__tests__/`, `*.test.*` anywhere, and `tests/setup-env.ts` or any `tests/` helper not mentioned under src/ all qualify; class C is `tests/**` spec files only, no setup/helper/fixture file -- grep: isClassCTestPath
- An independent-review-record check at the head sha for class C: no code reads `review-pack: <artifact> head <sha>` or the `review-passed` label (admin's `decideWalk` in its scripts/automerge-classify.mjs does a comparable check; Website's scripts/lib/autopilot-merge.mjs has REVIEW_LABEL and label-event logic to reuse, not copy) -- grep: reviewRecordVerdict
- Author tightening: `classify()` still accepts author 123constante on a claude/ or ccr- branch (WORKER_BRANCH); owner decision is BOT-authored only (kiki-claude-bot) -- grep: BOT_ONLY_AUTHOR
- Already on main, keep: guard-path refusal via `guardRefusals` (.github/automation/guard-paths.json), money-set check, pending-marker check, label/actor rules, head-sha-pinned `--match-head-commit` in the workflow -- extends: scripts/automerge-classify.mjs

## Files
scripts/automerge-classify.mjs (edit; it is itself a guard path), tests/automergeClassify.test.ts (extend), docs/automerge.md (state the three classes and the review-record rule; governance prose, stays owner-merged). Read first: scripts/lib/autopilot-merge.mjs (GOVERNANCE, REVIEW_LABEL, label-event logic), scripts/lib/guard-paths.mjs, .github/automation/guard-paths.json.

## What to build
1. Paths and caps. Class A/B: `docs/**/*.{md,png,jpg,jpeg,webp,gif}` and root `README.md`, under 400 lines, at most 60 files, GOVERNANCE files and CLAUDE.md/AGENTS.md still refused. Class C: `tests/**/*.test.{ts,tsx}` and `tests/e2e/**/*.spec.ts` only, under 200 lines, no removed or renamed test, nothing under `tests/` that is not a spec (setup-env.ts, helpers, fixtures refused). Anything else is a NO ("not on the A/B/C allowlist"). Report the class(es) judged.
2. Class C review record, fail closed. Qualifies only if ALL: a comment by `kiki-claude-bot` containing `review-pack: <https url> head <40-hex>` whose sha equals the PR head sha and was created after the head push time; label `review-passed` applied by kiki-claude-bot after that push. Fetch comments and label events in `main()`; any API failure, missing field, short sha or sha mismatch is a NO. A mixed PR (docs plus tests) is judged as class C. Classes A and B need no record (docs-only, bot-authored).
3. Bot-only author: remove the 123constante-on-claude/ arm; author must be kiki-claude-bot.
4. Tests, RED FIRST (run the new rows against the unchanged classifier and show them fail). Table rows: one per hard-tier path (scripts/x.mjs, bin/x, .githooks/x, .github/workflows/x.yml, .claude/x, scripts/lib/guard-paths.mjs, .github/automation/arming.json), each alone AND as ONE extra file inside an otherwise valid docs PR and valid test PR; plus docs/x.mjs, docs/x.json, README.MD, 61 files, a 200-line test PR, tests/setup-env.ts, a removed test, wrong-sha record, record older than the push, label applied by the owner, API error, owner-authored claude/ branch. MUTATION PROOF in the PR body: delete the `guardCheck` call and the forbidden-path check, show the "hard-tier file in a docs PR" rows go red, revert.

## Out of scope
No class F (src/ copy). No change to the workflow, repo variables, secrets or arming.json. Class file also lists `docs/review/<pr>-r<n>.md` naming the same sha; that file cannot live inside the PR it reviews (a push changes the head), so it is NOT required here.
Not verified by this brief: how the review-pack comment is posted on Website PRs today (admin's auto-pack posts it; confirm Website PRs get the same comment, else say so in the PR body).
Hand-off: Verified / Not verified block, per-job CI table, mutation output.
