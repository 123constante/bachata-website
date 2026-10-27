# Brief: P3 W2d continuation -- fix the red `phone-qa` check on PR #1068 (small, one file family)

Lane: normal. Repo 123constante/bachata-website. Branch `claude/p3-w2d-sessions-lineup` (PR #1068, head 3df98e4). Continue ON this branch; do not touch other branches.

## Failure (CI job phone-qa, "Run the phone suite")
`tests/e2e-phone/organiser-refusal-copy.phone.spec.ts:45`: `sample for /^(invalid_payload|permission_denied): series\.set_program / maps to a different sentence: Something went wrong. Please try again.`
The new `COMMAND_COPY` rule added by W2d in `src/modules/organiser/shared/selfServeErrors.ts` (line ~160) is anchored on `series.set_program ` but the spec builds a sample server message from each rule and expects it to map to THAT rule's own sentence. The sample falls through to the generic sentence. Likely cause: the spec's sample builder (read lines 1-60 of the spec) needs the rule's regex to match the text it generates, or the rule needs a `message` function / sample shape like its neighbours. Read how the other `{ match, message }` rows around it satisfy the spec, then make the rule satisfy the same contract. Same check for the `festival programmes are admin-only` rule.

## Do
1. Reproduce red first: run that spec alone (`npx playwright test --config playwright.phone.config.ts organiser-refusal-copy`). Do not weaken the spec.
2. Fix the rule (or its sample shape), re-run the spec green, then run the WHOLE phone suite once (`npx playwright test --config playwright.phone.config.ts`, 390x844 and 360x640) because the W2d worker only ran its own walk: fix any other red it shows and say which.
3. Re-run `src/modules/organiser/shared` and `src/modules/organiser/p3` vitest.
4. Check `git diff --name-only origin/main...HEAD` shows only W2d files (no foreign PNGs rewritten).
5. Push ONCE. Final commit subject ends with the done marker. Update the PR body line "Checks run" only if you changed what it claims (use the PR body file route, plain git only).

## Do NOT
Change any copy wording the owner would see unless the spec demands it; touch other PRs; merge; `--no-verify`.
