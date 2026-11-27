# Brief: review-1234-r1 (docs only; branch claude/review-1234-r1; Opus reviewing a Sonnet build)

Independent review of Website PR #1234 (head f14ea9884, branch claude/p3-pictures-walk): a new Playwright spec tests/e2e/walk-p3-series-pictures.spec.ts, added to the test:e2e:p3 script, plus a one-element product fix in src/modules/organiser/p3/screens/DetailsScreen.tsx (the Pictures sheet "Done" button wrapped in the existing sticky .p3-sheet-foot).
You change NO code on that branch. Your only push is docs/review/pr-1234-r1.md on claude/review-1234-r1.
Read: `git fetch origin claude/p3-pictures-walk` then `git diff origin/main...FETCH_HEAD`.
Questions:
1. Is the spec honest? Can any assertion pass vacuously (a locator that matches nothing, a boundingBox check that never runs, a `test.skip` or early return, waiting on a mock the page never calls)? Mutate the product: revert the .p3-sheet-foot wrap and confirm the 30-picture test goes red in BOTH light and dark; break the 44px size, the contrast token, the "no scroll on open" behaviour, and the "untouched save sends nothing" rule in turn and report which mutants the spec misses.
2. Does scripts/check-p3-specs-not-skipped.mjs stay green (run it and its --self-test)? Is the new spec listed in test:e2e:p3 and in NO other gate script?
3. The product fix: does .p3-sheet-foot stay readable and inside the viewport on a short screen (390x844 and 360x640), with the keyboard-free case only; does it overlap the last picture row or the "limit reached" reason at 30 pictures; any z-index or safe-area problem; is it the right existing class (compare other sheets that use it).
4. The PR body claims "88 passed / 9 skipped / 1 failed (golive review variant, under load; rerun 20/20)". Judge whether the 9 skips and the flake are inherited from main (check main's CI log or run the same spec list on main) and whether the flake is a real race.
5. Data shapes: the spec uses mocks of 0/1/2/30 pictures and a festival. Cross-check against prod shapes via read-only SELECT (Supabase project stsdtacfauprzrdebmzg, counts only): is there any shape (e.g. a gallery over 30, a null gallery, a festival with pictures) the spec does not cover?
Output: verdict PASS / PASS WITH NITS / BLOCK, findings F1.. with file:line and a concrete failing scenario, and an honest Verified / Not verified list. Commit subject ends [worker-done <ticket>].
