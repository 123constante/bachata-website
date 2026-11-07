# BRIEF: phone-qa 44px sub-pixel failures (Website; normal lane; Sonnet; test files)

Brief-version: 2
Branch: claude/phone-qa-44px-subpixel
Source: Phone QA run 42332659743 (PR #1428 branch, shard 1, attempts 1 and 2 both red): tests in tests/e2e-phone/invite-w2-golive.phone.spec.ts fail with `raffle phone box height Expected >= 44 Received 43.99688720703125` and the same family (phone question, Instagram question, teach/DJ question). The sharded suite passes on other PRs, so this is a sub-pixel rounding threshold, not a visual regression. Serves: unblocks every UI PR's phone-qa gate.

## What main lacks
- a named sub-pixel tolerance for the 44px tap rule in phone specs -- grep: MIN_TAP_PX
- a passing phone-qa shard 1 on PR #1428 -- #1428

## Files
- extends: tests/e2e-phone/invite-w2-golive.phone.spec.ts
- extends: tests/e2e-phone/helpers.ts (only if screenChecks/small filter lives there; find it first; do not create it)

## Build
1. Find where `small` (controls shorter than 44px) is computed for `screenChecks` and the two direct assertions at lines 253 and 276. Replace the strict `< 44` / `>= 44` with a named constant `MIN_TAP_PX = 43.9` (comment: sub-pixel rounding at 390x844 gives 43.997; the design rule stays 44px) and use it in all of them in tests/e2e-phone/** that compare against 44 (grep the 19 occurrences; change only those that are the 44px tap rule, never a different number).
2. Do NOT change src/components/forms/PhoneInput.tsx or any CSS. Do not weaken any other assertion (contrast, overlap, scroll).
3. Prove: run `npx playwright test --config playwright.phone.config.ts tests/e2e-phone/invite-w2-golive.phone.spec.ts` if browsers are installable in the sandbox; otherwise run `npx tsc --noEmit -p .` and say browser run is Not verified (CI shard run is the proof).

## Hard limits
Test files only. No workflows, no src. Push ONCE, bot PR. PR body: Phone QA heading "no UI path changed; test tolerance only", Verified / Not verified block. Last commit subject ends `[worker-done <ticket>]`. [skip preview] in the PR title (no deploy).
