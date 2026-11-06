# Brief: migrate the three p3-batch-1 walk specs to the shared garbled-text helper
Brief-version: 2
Branch: claude/walk-specs-use-garbled-helper
Lane: normal, Sonnet. 123constante/bachata-website, test files only; no src/**, no workflow, no calendar density-exclusion file, no change to tests/e2e/helpers/garbled.ts.
Serves: the lead and workers who walk organiser screens (one garbled-text pattern, so a fix to it reaches every walk).

## What main lacks
- extends: three walk specs still carry their own inline copy of the garbled-text regex; they must import findGarbled -- tests/e2e/walk-p3-batch-1-dates.spec.ts
- extends: same inline copy in the door walk spec -- tests/e2e/walk-p3-batch-1-door.spec.ts
- extends: same inline copy in the status walk spec -- tests/e2e/walk-p3-batch-1-status.spec.ts
- extends: INLINE_ALLOWLIST in the guard still lists those three and must become empty -- tests/walkGarbledHelper.test.ts

## Files
tests/e2e/walk-p3-batch-1-dates.spec.ts
tests/e2e/walk-p3-batch-1-door.spec.ts
tests/e2e/walk-p3-batch-1-status.spec.ts
tests/walkGarbledHelper.test.ts

## What to build
1. In each of the three specs replace the inline `text.match(/\u00c3.|...|\ufffd/g) ?? []` line with `findGarbled(text)` and add `import { findGarbled } from './helpers/garbled';`. The recorded observation (`garbled` field) stays the same array.
2. In tests/walkGarbledHelper.test.ts set `INLINE_ALLOWLIST` to an empty array and delete the "allowlisted ... still has the inline copy" `it.each` block (an empty `it.each` fails) and the comment saying a follow-up PR empties the list.
3. Keep every source file pure ASCII with `\u` escape syntax only (scripts/check-mojibake.mjs must stay green); do not touch any other walk spec.

## Tests
Table-driven, red first: before step 1, run `npx vitest run tests/walkGarbledHelper.test.ts` with the allowlist already emptied and show the three `has no inline copy unless allowlisted` rows red; after step 1 all rows are green. Also run `node scripts/check-mojibake.mjs` and `npx tsc --noEmit -p .` filtered to the four files.

## Done when
- The guard test has no allowlist and passes; the three specs import the shared helper; no other file changed.
- PR body carries a Verified / Not verified block (Verified: the red-then-green output, mojibake check, tsc; Not verified: the specs were not re-run in a browser, they are report-only walks).
