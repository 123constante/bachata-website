# Brief: tie the walk judge's screen list to docs/design/walk-coverage.json
Brief-version: 2
Branch: claude/walk-judge-screens-tied-to-coverage
Lane: careful, Opus. 123constante/bachata-website, scripts/lib walk modules, their tests and the judge spec only; no workflow, no package.json, no src/**, nothing is armed or dispatched.
Serves: the owner and lead (a walk verdict that cannot quietly skip a screen the coverage table says must be walked).

## What main lacks
- The judge trusts the lane's own screen list: a screen that docs/design/walk-coverage.json requires can be left out of input.screens and the verdict still passes. A pure check must compare the two -- grep: screensMissingFromCoverage
- extends: judgeVerdict and the CLI accept the coverage document optionally and go red on any mismatch (CLI flag --coverage) -- scripts/lib/walk-judge.mjs
- The spec does not say the screen list is tied to coverage (its "Parts left" section still lists it as open) -- grep: input.screens is compared with walk-coverage.json

## Files
scripts/lib/walk-fixtures.mjs
scripts/lib/walk-judge.mjs
tests/walkFixtures.test.ts
tests/walkJudge.test.ts
docs/automation/judge-worker.md
docs/handover/walk-gate-judge-web.md

## What to build
1. In scripts/lib/walk-fixtures.mjs add exported pure `screensMissingFromCoverage(walkCoverage, inputScreens)` returning a list of problem strings and never throwing: a non-example coverage screen absent from inputScreens; an input screen absent from coverage; a coverage shape absent from that input screen. Example rows (`"example": true`) are ignored. Malformed input returns one problem string.
2. In scripts/lib/walk-judge.mjs let `judgeVerdict(input, report, coverage)` take an OPTIONAL third argument; when given, every problem from step 1 becomes a red reason prefixed `coverage:`. When omitted the verdict is byte-for-byte the current one. `main` reads an optional `--coverage <file>`; an unreadable coverage file is red, not ignored.
3. Update docs/automation/judge-worker.md (new line in the verdict reasons, remove the open item from "Parts left") and the handover note; the spec/module constant tables must still compare equal both ways in tests/walkJudge.test.ts.
4. State in the PR body that Part D's caller must pass the live coverage file and the PR's live head; nothing here wires it.

## Tests
Table-driven, red first (both test files fail to load the new export before step 1): cases = coverage screen missing from input, extra input screen, missing shape, example row ignored, empty coverage, malformed coverage, coverage omitted (verdict unchanged against the existing fixtures), unreadable --coverage file. Add at least three mutants (drop the missing-screen check, drop the extra-screen check, treat example rows as real) and show each turns a test red. Run `npx vitest run tests/walkJudge.test.ts tests/walkFixtures.test.ts tests/walkWaiver.test.ts`, `node scripts/check-script-conventions.mjs`, `npx tsc --noEmit -p .` filtered to changed files.

## Done when
- All walk tests green, existing 201 untouched or still green; mutants killed.
- PR body: Verified / Not verified block (Not verified: nothing calls the judge in CI yet; hard-tier path, owner Approve at head).
