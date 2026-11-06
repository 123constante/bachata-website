# Brief: assemble the judge report from raw runner records (Part B glue)
Brief-version: 2
Branch: claude/walk-report-builder
Lane: careful, Opus. 123constante/bachata-website, scripts/lib and its test only; no workflow, no package.json, no playwright config, no src/**; nothing is armed or dispatched.
Serves: the lead (a walk runner can hand raw per-engine numbers and picture files to one pure function and get a report the judge accepts).

## What main lacks
- judgeVerdict(input, report) needs report = { headSha, measurements[screen][shape][engine], pictures[{name,sha256}], doubts } with picture names `<screen>--<shape>--<engine>.png` (scripts/lib/walk-judge.mjs lines 180-215), but no code builds that object -- grep: buildJudgeReport
- extends: ENGINES, VIEWPORT, RUBRIC are exported from scripts/lib/walk-judge.mjs and must be imported, not copied -- scripts/lib/walk-judge.mjs

## Files
scripts/lib/walk-report.mjs (new)
tests/walkReport.test.ts (new)
docs/automation/judge-worker.md (one line: report builder exists, not wired)

## What to build
1. Pure `buildJudgeReport({ headSha, records, pictures, doubts })` where records = [{ screen, shape, engine, viewport, ...rubric ids }] and pictures = [{ name, sha256 }]. Groups into measurements[screen][shape][engine]; copies only RUBRIC ids and viewport; keeps pictures as given; returns { report, problems[] }. Never throws, never invents a number: a missing field stays missing so the judge goes red. Duplicate (screen,shape,engine) records are a problem and the second is NOT silently merged. A record whose engine is not in ENGINES, or a non-finite number, is a problem and is dropped from the report (the judge then reports it absent).
2. Pure `pictureName(screen, shape, engine)` used by both this module and the tests so the name format has one definition; a test asserts it equals the judge's expectation.
3. `main(argv)` CLI: `--records <file> --pictures <file> --head <sha> [--doubts <file>]` prints the report JSON; exit 0 only when problems is empty, 1 otherwise (still prints the report), 2 usage.
4. Add the file to TARGETS in scripts/prove-entry-point-dispatch.mjs like the other walk modules.

## Tests
Table-driven, red first: round trip (builder output fed to judgeVerdict with a matching input passes on good fixtures from scripts/lib/walk-fixtures.mjs and goes red when one webkit record is removed), duplicate record, unknown engine, NaN, extra unknown fields stripped, empty records, head not 40-hex, picture name format. Three mutants (merge duplicates, drop the engine filter, hard-code chromium only) each turn a test red. Run `npx vitest run tests/walkReport.test.ts tests/walkJudge.test.ts tests/walkFixtures.test.ts`, `node scripts/check-script-conventions.mjs`, `node scripts/prove-entry-point-dispatch.mjs`, `npx tsc --noEmit -p .` filtered to changed files.

## Done when
- New tests green, mutants killed, existing walk tests untouched.
- PR body: Verified / Not verified (Not verified: no real Playwright run feeds it yet; hard-tier path, owner Approve at head).
