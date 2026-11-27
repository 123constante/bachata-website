# Brief: Website auto-merge test-source refusal, fix round 1 (review findings on PR 1468)

Brief-version: 2
Branch: claude/automerge-web-test-source-refusal
Lane: careful, Opus, CONTINUATION on the same branch and the same PR (Website PR 1468). bachata-website; scripts + tests + docs only, no src/, no workflow edit. Hard tier: you never approve or merge. ONE push at the end.
Serves: the owner, who wants class-C test PRs to auto-merge safely and never a test that reads CI workflows or runs guard scripts.

## What main lacks
- a refusal for a class-C test that shells out to a guard script with a space before the path, or reads a CI workflow file, or loads bin/api/server/supabase trees -- grep: REFUSED_TREES
- a Supabase rule that keeps the admin cases (service-role key, a client built from any path) without refusing every test that merely mocks the app's own supabase client import -- grep: SUPABASE_LIVE

## Files
scripts/automerge-classify.mjs (exists on the PR branch)
tests/automergeClassify.test.ts (exists on the PR branch)
docs/automerge.md (exists on the PR branch)
docs/arcs/automation.md (exists on the PR branch)
docs/handover/automerge-web-test-source-refusal.md (new, exists on the PR branch)

## What to build
The independent review is not in git, so use the findings below (file:line as of PR head abc44a3).
1. MUST-FIX, about line 119: the scripts rule misses `execSync('node scripts/x.mjs')` (a space before the path) and any quoted path through `.github/`. Add a constant named REFUSED_TREES: refuse a quoted string containing `node scripts/`, or a path segment `.github/`, `bin/`, `api/`, `server/` or `supabase/` (as a directory segment, not a substring of another word such as `abin/`). Keep the existing scripts rule. A real example on main: tests/autopilotWorkflow.test.ts reads ../.github/workflows/autopilot.yml; it must now be refused. Add one red-first table row for each new shape and one negative row per segment that must stay allowed (for example the word `binary` and a `public/api-notes.md` string).
2. MUST-FIX: docs/arcs/automation.md, the edited "Follow-ups from the auto-merge review" row has 6 cells in a 4-column table. Collapse to 4 cells (Item, Repo, Blocked by, Source), moving the status text into Blocked by.
3. Nit, do it: replace the bare `/supabase/i` rule with a constant named SUPABASE_LIVE that refuses: `SUPABASE`, `SERVICE_ROLE`, `@supabase/supabase-js`, `createClient(` (admin's cases), plus a live-project URL `supabase.co`, and a `.from(` or `.rpc(` call on a client created inside the test. It must NOT refuse a test that only does `vi.mock('@/integrations/supabase/client')` or imports a type from `@/integrations/supabase/...`. Rows: SERVICE_ROLE refused, `createClient(` refused, vi.mock of the app client allowed.
4. Nit, do it: in docs/automerge.md and the code comment replace "Ported from the admin classifier" with "Adapted from the admin classifier: stricter on node:test and scripts/, different on Supabase". Say in the doc that a test embedding a literal U+FFFD is refused.
5. Nit, do it: report how many of the test files on main would now be refused, by rule (run the new classifier function over `git ls-files tests` text in a loop in a node one-liner, no repo edit). Put the three counts in the handover.

## Tests
Table-driven additions as named, red first (run the new rows on the unfixed code and record how many fail). Mutate each new constant once (empty REFUSED_TREES, drop SERVICE_ROLE) and see rows fail. Run tests/automergeClassify.test.ts, tests/realDataVerified.test.ts, tests/automationMoney.test.ts and tests/automationGuardPaths.test.ts, then `npm run lint`.

## Done when
Tests green; the PR 1468 body is updated by the lead (do not edit it); handover docs/handover/automerge-web-test-source-refusal.md gets a "Fix round 1" section listing each finding and how it was fixed or why not, with the three counts; last commit subject ends with your worker-done marker; one push.
