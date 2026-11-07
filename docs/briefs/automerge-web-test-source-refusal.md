# Brief: Website auto-merge refuses test files that import scripts/ (review nits)
Brief-version: 2
Branch: claude/automerge-web-test-source-refusal
Lane: careful, Opus. bachata-website; do not touch .github/workflows, bot-automerge.yml wiring, or any src/ file
Serves: the owner, who wants class-C test PRs to auto-merge safely; arc row "Follow-ups from the auto-merge review" in docs/arcs/automation.md

## What main lacks
- Website classifier has no content check: a test importing scripts/ or node:test or Supabase is still class C -- grep: testSourceRefusal
- no test for a copied test file being refused -- grep: copied test is refused
- no test that readReviewRecord asks for head_sha and per_page=100 and pages comments -- grep: readReviewRecord query params
- extends: classify() takes no test-source input -- scripts/automerge-classify.mjs

## Files
docs/arcs/automation.md
scripts/automerge-classify.mjs
tests/automergeClassify.test.ts
docs/automerge.md

Update the follow-ups row in docs/arcs/automation.md (Status, Blocked by, PR link) in the same PR (owner decision 2026-11-06).

## What to build
1. Port `testSourceRefusal(path, text)` from admin scripts/automerge-classify.mjs (refuses node:test suites, imports of scripts/, Supabase references, unknown content), then give main() fetch the head content of each class-C file and pass it to classify as `testSources`; unknown content is a NO.
2. Table-driven tests for testSourceRefusal and classify (clean test passes; each refused shape gives its own reason; missing content refuses).
3. Test that a copied test file is refused as class C.
4. Test that readReviewRecord requests commits/<sha>, actions/runs?head_sha=<sha>&per_page=100 and pages issue comments; document the new refusal in docs/automerge.md.

## Tests
Table-driven in tests/automergeClassify.test.ts. Red first: run the new rows against unfixed code and show them failing. Run npm run test:unit and npm run lint.

## Done when
- scripts/ is hard tier: PR waits for owner Approve at final head. Every CI job step run, per-job table in the PR body.
- Verified / Not verified block in the PR body (shapes: test importing scripts/, node:test, Supabase, clean, copied, content unreadable).
