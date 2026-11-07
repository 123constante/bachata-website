# Handover: walk report builder (brief walk-report-builder, Brief-version 2)

Ticket: dt_efd612b02cc5. Branch: `claude/walk-report-builder`.

## Done
- `scripts/lib/walk-report.mjs` (new): pure `buildJudgeReport({ headSha, records, pictures, doubts })`
  returns `{ report, problems[] }`, never throws. Imports `ENGINES`, `RUBRIC` from walk-judge.mjs.
  Copies only RUBRIC ids and viewport `{width,height}`. Duplicates, unknown engines and
  non-finite / non-number rubric values are problems and the record is dropped. Missing
  fields stay missing (and are listed as problems). Pictures and doubts pass through as given;
  a kept record with no matching picture is a problem. `pictureName()` is the one name format.
  CLI `--records --pictures --head [--doubts]`: 0 no problems, 1 problems (report still
  printed) or unreadable file, 2 usage.
- Added to TARGETS in `scripts/prove-entry-point-dispatch.mjs`.
- `docs/automation/judge-worker.md`: one line under "Parts left" (exists, not wired).
- `tests/walkReport.test.ts` (new, 32 tests): round trip through `judgeVerdict` on
  walk-fixtures shapes (pass; red when one webkit record is removed), duplicate, unknown
  engine, NaN, Infinity, string number, missing field, missing viewport, stripped extras,
  empty records, head not 40-hex (4 rows), picture name format, main() exit codes.

## Mutants (each run against tests/walkReport.test.ts, then restored)
| Mutant | Result |
|---|---|
| M1 merge duplicates (duplicate check disabled) | 2 failed |
| M2 drop the engine filter | 1 failed |
| M3 hard-code chromium only | 8 failed |

## Checks run
- `npx vitest run tests/walkReport.test.ts tests/walkJudge.test.ts tests/walkFixtures.test.ts`: 257 passed.
- `node scripts/check-script-conventions.mjs`: passed. `node scripts/prove-entry-point-dispatch.mjs`: passed (77 entry points).
- tsc run on 2d78c63: 0 errors in branch files. `npm run check:mojibake`: clean.
- One `/code-review` round (stopping rule: one, tooling). Finding fixed: a dropped bad record
  was called "kept" in the duplicate message and its picture was demanded.

## Not verified
- No real Playwright run feeds the builder yet; no walk runner calls it.
- Hard-tier path: owner Approve at head needed. Nothing armed or dispatched.

## Next
- Part B runner: write flat records + picture list, call `main()` or `buildJudgeReport`, hand the report to the judge.
