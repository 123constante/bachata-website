# W2-D step 1: dancer-area test drops the dancer-only row (one file, test only)

Repo 123constante/bachata-website. Branch `claude/oneback-no-hub-row`, created from `origin/main`. You are the only worker on it.

## Why
PR #963 (branch claude/w2d-hub-build) makes `/people/<slug>` 302 a one-role person back to their role page. The role bar's
"Back to <name>" on that page then loops. The fix goes in person-page `roleSwitchModel` (a separate worker on #963). It
changes what `src/modules/dancer-app/public-page/__tests__/oneBack.test.tsx` expects for a dancer-only person. #963 cannot
touch that file: any dancer-app file turns #963 into a dancer-area PR, and `scripts/check-dancer-area-isolation.mjs` rule (a)
then fails on its 14 person-page files. So this tiny dancer-area-only PR merges FIRST and removes the one row.

## The change (exactly this, nothing else)
In `src/modules/dancer-app/public-page/__tests__/oneBack.test.tsx` replace

```
// Prod role shapes for a dancer row (badges survey 2026-10-22): no public role, dancer only,
// teacher+dancer (teacher page closed = one role page), dj+dancer (two role pages).
const ROLES: [string, PersonRole[], boolean][] = [
  ['no public role (hub would 404)', [], false],
  ['one role', ['dancer'], true],
  ['one role page (teacher closed)', ['teacher', 'dancer'], true],
```

with

```
// Prod role shapes for a dancer row (badges survey 2026-10-22): no public role,
// teacher+dancer (teacher page closed = one role page), dj+dancer (two role pages).
// Dancer-only is left out on purpose: whether one held role gets the bar is decided by
// person-page roleSwitchModel (W2-D: /people/<slug> 302s a one-role person back to this
// page, so no bar) and pinned in person-page/__tests__/roleSwitch.test.tsx.
const ROLES: [string, PersonRole[], boolean][] = [
  ['no public role (hub would 404)', [], false],
  ['one role page (teacher closed)', ['teacher', 'dancer'], true],
```

Keep the file's line endings. Use HTML-safe ASCII only (no Unicode punctuation).

## Checks (run each, report the result)
- `npx vitest run src/modules/dancer-app/public-page/__tests__/oneBack.test.tsx src/modules/person-page` passes.
- `node scripts/check-dancer-area-isolation.mjs` says `dancer-area PR: rules a+b+c` and OK.
- Every step of the unit-tests, architecture-guard and workflow-lint jobs (read `.github/workflows`). Known on main:
  `datesCard.consistency.test.tsx` fails (date-dependent) and live contract suites need prod secrets; say so, do not fix.

## Push
ONE commit, subject: `test(dancer): oneBack drops the dancer-only row; the one-role bar rule lives in person-page roleSwitch [worker-done <ticket>]`.
Body: the "Why" above in two lines. No handover doc needed; report the per-job table in your final message.
