# Brief: claim sheet and search keep their promises (P3 onboarding)
Brief-version: 2
Branch: claude/claim-sheet-honest-retry
Lane: normal, Sonnet. Website only, no database change, no new copy decisions beyond what is named here.
Serves: organisers claiming their page (4-week goal: 10 organisers claim and edit).

## What main lacks
- After a refused claim (`organiser_already_claimed`, `email_mismatch`, `no_contact_email`) the sheet still shows [Claim it]; the error line says "request access" but no such button exists on the P3 sheet -- grep: p3-ob-claim-switch
- A failed page search shows red text and no control; the person must retype to search again (`retry: false`) -- grep: p3-ob-find-retry
- The P3 sheet ignores the `next: 'request_access'` that `selfServeErrorCopy` already returns -- extends: src/modules/organiser/p3/onboarding/OnboardingFlow.tsx

## Files
- src/modules/organiser/p3/onboarding/OnboardingFlow.tsx (ClaimSheet ~L820-890, FindStep ~L750-775 only)
- src/modules/organiser/p3/onboarding/__tests__/pageScreens.matrix.test.tsx (extend) and a new `claimRefused.matrix.test.tsx` beside it
- Do NOT edit src/modules/organiser/shared/selfServeErrors.ts (shared with R1 PublicClaimCard, where a Request access button does exist).

## What to build
1. In ClaimSheet, when a claim is refused with `next === 'request_access'`, replace the red line with a P3 line (table keyed by code, "Ask to join" wording, never "Request access") and switch the primary button to [Ask to join] (calls `writes.ask`). `mailbox_unproven` keeps its current "Confirm with an email code" path untouched.
2. In FindStep, on `res.isError` render the same red line plus a [Try again] button (`data-testid="p3-ob-find-retry"`, calls `res.refetch()`), min height 44px.
3. Both controls use existing `p3-ob-btn` / `p3-ob-lnk` classes; compact density (p-3, text-sm, py-2 px-3 buttons); no sideways scroll at 390x844.

## Tests (red first, run against unfixed code before the fix)
Table-driven: every refusal code x {button label, red line has no "request access", tap sends `ask` not `claim`}; search error x {Try again visible, tap refetches, success replaces the error}; `mailbox_unproven` and `request_already_open` unchanged; untouched sheet sends nothing.

## Done when
Matrix green, existing onboarding tests (13 files) green, PR body has Verified / Not verified (state: not walked on a real claim; prod has 0 claim emails so the Claim it path is only reachable by fixture).
