# Brief: finish the #764 journey-matrix follow-up (continuation)

Repo: 123constante/bachata-website. Branch: `claude/dancer-app-routing` (PR #764), head 255d7ac9. Push to it only.
Read first: `docs/review-packs/public-journeys/FOLLOWUP-HANDOVER.md` and `MATRIX.md` on the branch (the previous
worker's report; it stopped at its context limit without a done marker). Do NOT redo its work.

## What is left (quoted from its handover + orchestrator review)
1. (DONE by the previous worker at d671a70: e2e-smoke exit 0, 148 passed, 1 skipped. Do not re-run unless your
   change touches what it covers.)
2. MATRIX M77 is PARTIAL: "no spec signs B in as an organiser after A". Add that case to
   `tests/e2e-build/account-edges.build.spec.ts` (A signs out, B with an organiser side signs in on the same browser:
   B's chooser/landing shows only B's sides and nothing of A). Red-first is not possible for a passing behaviour: instead
   prove the spec is not vacuous (break the uid-keyed query key locally, see it fail, revert, paste both).
3. MATRIX M44 is PARTIAL: add the build walk for "no side, not admin -> /app/welcome" next to the unit rows, if the fakes
   can express that person; else say exactly why not.
4. Write `docs/review-packs/public-journeys/PR-BODY.md` with "## Phone QA" and "## Verified on real data" written so
   `scripts/check-pr-phone-qa.mjs` and the real-data check pass on it (run both against the file). Include a
   "Decided for the owner" list copied from the handover, plus: perf budget /app/* 360 -> 361 KB (+0.4 KB measured), and
   "unsaved organiser and vendor drafts are cleared on sign-out (privacy default D1)".
5. Update MATRIX.md rows M44/M77 and the handover.

## Gates (CI without paying GitHub)
Billing annotations are not code failures. Re-run only what your change touches plus e2e-smoke and build-smoke
(`playwright.build.config.ts`), unit in the 3 timezones for the touched tests, `npm run build`. Table (command, exit).

## Rules
- Plain git for read and push. NEVER `gh api`, never `gh pr edit`. Shell commands without variables, loops or `$(...)`
  where a plain command works. Never merge or approve. Never `--no-verify`. Supabase READ-ONLY.
- Context: at 25% start nothing new; by 30% push + handover with `PARTIAL [worker-done <ticket>]`.
