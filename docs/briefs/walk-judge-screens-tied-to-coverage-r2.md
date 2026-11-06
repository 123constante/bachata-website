# Brief: walk judge compares input.screens with walk-coverage.json, REBUILD from main (replaces conflicting PR #1435)
Brief-version: 2
Branch: claude/walk-judge-screens-coverage-r2
Lane: careful, Opus. 123constante/bachata-website, scripts/lib, tests and docs only; no workflow, no package.json, no src/**.
Serves: the owner and lead (the walk judge cannot pass a walk that skipped a screen listed in the coverage file).

## What main lacks
- the optional coverage argument to the judge verdict and the screensMissingFromCoverage check -- grep: screensMissingFromCoverage
- extends: the finished, reviewed implementation exists on origin branch claude/walk-judge-screens-tied-to-coverage (PR #1435, head 022b6d6e) but its merge with main has real overlapping changes in scripts/lib/walk-judge.mjs, walk-fixtures.mjs or the two docs; reuse it and re-apply by hand, do not redesign -- scripts/lib/walk-judge.mjs

## Files
- scripts/lib/walk-judge.mjs
- scripts/lib/walk-fixtures.mjs
- tests/walkJudge.test.ts
- tests/walkFixtures.test.ts
- docs/automation/judge-worker.md
- docs/handover/walk-gate-judge-web.md

## What to build
1. Cut the branch from current origin/main.
2. All six files exist on main and changed there since the old branch. For each, read the old change with `git diff origin/main...origin/claude/walk-judge-screens-tied-to-coverage -- <path>` (about +296 -18 in total) and re-apply that intent by hand onto main's current text: the `screensMissingFromCoverage` export, the optional third `coverage` argument to `judgeVerdict` (omitted = exactly the two-argument verdict), the `pre` reasons plumbing in `judge`, the fixtures and the new tests, the two doc updates.
3. Run tests/walkJudge.test.ts, tests/walkFixtures.test.ts and every other walk test, `node scripts/prove-entry-point-dispatch.mjs`, and the script checks that apply to scripts/ changes; all green. Push once, final commit subject ending [worker-done <ticket>].

## Tests
The old tests must pass; where main changed behaviour they touch, adapt the minimum and say why in the handover.

## Done when
- Rebuilt branch = main plus these six files, all checks green locally.
- PR body: Verified / Not verified (hard-tier path scripts/lib: owner Approve at head). Say it replaces #1435, which the lead will close.
- No screen or UI is built, so INVENTORY.md does not apply; report coverage as the number of rubric reasons covered by tests / total.
