# Brief: rewrite the stale walk-p3-w4b-onboarding spec (Website, normal lane), Sonnet

Branch `claude/guard-p3-walk-specs` (PR #1231). Pull main in first only if it is behind; ONE push at the end. Under 50% context, nothing new at 45%. Final commit subject ends `[worker-done <ticket>]`. Test-only: change only `tests/e2e/walk-p3-w4b-onboarding.spec.ts` (and a tiny helper next to it if needed). No src change, no workflow/script change, no migration, no prod write.

## Why
#1231 makes the P3 walk specs run in CI instead of skipping. `walk-p3-w4b-onboarding.spec.ts` was skipped for a long time and went stale: the Welcome screen now shows a "Find your page" button before `onboarding-search`, so 10 tests (light + dark) fail in the CI step "Run E2E P3 walk specs (P3 flags on)": brand new Welcome/search/claim, no match/create name/city step, unfinished profile (`toBeEnabled` fails), no dancer row, open request (`toContainText` fails).

## Do
1. Read the failing job output: `gh run view 41209771297`/the run for this branch head, or run `npm run test:e2e:p3 -- walk-p3-w4b-onboarding` locally with `VITE_ENABLE_ORGANISER_P3=true VITE_ENABLE_ORGANISER_SELF_SERVE=true VITE_ENABLE_TICKETING=true` (see the e2e-smoke step env). Read the current screens under `src/modules/organiser/home/onboarding/` to learn the real flow.
2. Update the spec to the CURRENT flow, step by step, keeping each test's intent (the title says what it proves). Assertions must still prove the behaviour (claim lands on Home with the confirmation; no-match goes to create; unfinished profile tap says what is missing and sends nothing; no dancer row shows Message us and sends nothing; open request shows the waiting card and ask-to-join ends on Done). Do NOT loosen assertions to pass and do NOT skip or quarantine a test. If a test's intent no longer exists in the product, say so in the PR comment and report instead of deleting it.
3. All 10 tests green in light and dark with the flags on; run the whole `test:e2e:p3` once to show the other 6 specs still pass. Do not add `test.skip`.
4. Update the `## Verified` table in the PR body with the real result. Honest Not verified.
