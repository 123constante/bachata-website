# Handover: automerge-refuse-to-fill-1

Ticket dt_1dd36768c977. Brief: `brief/automerge-refuse-to-fill-1:docs/briefs/automerge-refuse-to-fill-1.md` (v2).
Branch `claude/automerge-refuse-to-fill-1`, cut from main `a7adf1f`.

## Done
- `scripts/automerge-classify.mjs`: `classify()` now refuses (qualifies=false, reason
  naming the section and the marker) when the `## Verified on real data` or the
  `## Phone QA` section still carries the pending marker. The marker and both
  headings are IMPORTED from `check-pr-real-data-verified.mjs` (`MARKER`, `HEADING`)
  and `check-pr-phone-qa.mjs` (`HEADING`), never typed. New pure export
  `pendingSections(body)`; `PENDING_SECTIONS`. The check runs whether or not the
  real-data parser is loaded. Fail closed kept: no marker = a NO reason; either
  checker unreadable = import fails = exit 2 = NO.
- A deleted or bare empty `## Phone QA` section is NOT a refusal (docs-only workers
  may delete it). Markers inside `<!-- -->` or a fenced block are not counted (same
  rule as the checkers). The bot's intro line above the sections is not counted.
- `selfTest()` gained a "pending Phone QA stub does not" case.
- `tests/automergeClassify.test.ts`: table of bodies x qualifies, run twice (real
  parser / no parser): filled + filled QA, filled + no QA, filled + bare QA heading,
  intro-line marker only, real-data pending, Phone QA pending, both pending,
  docs-only with Phone QA pending, one QA line pending; plus section naming,
  comment/fence, and non-vacuity cells.

## Red first (new cells run against main's classify, before the fix)
```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 9 ⎯⎯⎯⎯⎯⎯⎯
- FAIL tests/automergeClassify.test.ts > automerge classifier -- a TO FILL stub never merges (F1, PR #1323 review) > real parser: Phone QA pending
- FAIL tests/automergeClassify.test.ts > automerge classifier -- a TO FILL stub never merges (F1, PR #1323 review) > real parser: docs-only with Phone QA pending
- FAIL tests/automergeClassify.test.ts > automerge classifier -- a TO FILL stub never merges (F1, PR #1323 review) > real parser: one Phone QA line still pending
- FAIL tests/automergeClassify.test.ts > automerge classifier -- a TO FILL stub never merges (F1, PR #1323 review) > no parser: real-data pending
- FAIL tests/automergeClassify.test.ts > automerge classifier -- a TO FILL stub never merges (F1, PR #1323 review) > no parser: Phone QA pending
- FAIL tests/automergeClassify.test.ts > automerge classifier -- a TO FILL stub never merges (F1, PR #1323 review) > no parser: both pending
- FAIL tests/automergeClassify.test.ts > automerge classifier -- a TO FILL stub never merges (F1, PR #1323 review) > no parser: docs-only with Phone QA pending
- FAIL tests/automergeClassify.test.ts > automerge classifier -- a TO FILL stub never merges (F1, PR #1323 review) > no parser: one Phone QA line still pending
- FAIL tests/automergeClassify.test.ts > automerge classifier -- a TO FILL stub never merges (F1, PR #1323 review) > names the section that is pending
      Tests  9 failed | 77 passed (86)
```
"real parser: real-data pending" / "both pending" were already NO on main (the
parser refuses them); every Phone QA cell and every no-parser cell was red.

## Green after the fix
- `vitest run tests/automergeClassify.test.ts tests/realDataVerified.test.ts tests/phoneQaSection.test.ts`: 3 files, 218 tests passed.
- `--self-test` equivalent (`m.selfTest()`): 5/5 ok, exit 0.
- `npm run lint`: 24 of 24 links green (trailing whole-tree eslint informational); scoped eslint on both files clean.
- `npm run check:mojibake`: clean. `npm run check:integrity`: ok.

## Left / next
- Hard tier: the owner Approves at head. No automerge-ok label (scripts/ change).
- Not verified: the live `bot-automerge.yml` run against a real PR (needs the workflow switches on).
