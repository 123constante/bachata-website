# Brief: independent review of PR #1535 at head a569a715e2223fa7072af671c44f7232a41c8459

Repo 123constante/bachata-website. READ-ONLY review; do not edit PR #1535's branch.
Write your verdict to `docs/review/review-1535-r1.md` on branch `claude/review-1535-r1` (docs only) and open a docs PR.

## What the PR does
Removes `workflow-lint.yml` from `scripts/data/automation-workflow-allowlist.json` (now `[]`) so an automation-loop PR
(claude/, ccr-, kiki-claude-bot branches) can no longer edit the workflow that lints it. It also touches
`scripts/check-automation-workflow-allowlist.mjs` and `tests/automationWorkflowAllowlist.test.ts` (the committed-list test now
accepts an empty list but still rejects a malformed one). No user data, no migration, no site code.

## Review target (answer each, PASS/FAIL with file:line)
1. With the list `[]`, does the guard block EVERY loop-PR edit to any `.github/workflows/*` file (no off-by-one, no empty-list bypass such as "empty list = allow all")?
2. Does it still allow non-loop branches (owner push) to edit workflows? Does `--merge` mode behave correctly on an empty list?
3. Run `node scripts/check-automation-workflow-allowlist.mjs --self-test` (expect 36 cases PASS) and the vitest file `tests/automationWorkflowAllowlist.test.ts`.
4. Mutation check: make the guard treat `[]` as "allow all" in a scratch copy; the tests must go red. If they stay green, say so.
5. Is the header comment in the JSON accurate, and is the loader still robust to a malformed file (not an array, non-string entries)?

CI context: unit passed after rerun; seo-preview is red at this head and ALSO red on main (run 42936670025, same two rogue-bachata event pages lack Event JSON-LD, live-data, unrelated).
Stopping rule: ONE round. Output: verdict PASS / PASS-with-fixes / FAIL, then findings, then Verified / Not verified.
