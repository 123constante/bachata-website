# Brief: walk A -- an organiser finds their unclaimed page and claims it (REPORT ONLY), Sonnet

Brief-version: 2

Lane normal, model Sonnet, branch `claude/walk-claim-find-claim`. REPORT ONLY: no product code, no feature PR, no `.github/**`. Supabase read-only (prod `stsdtacfauprzrdebmzg`, counts only, no personal data in the report). Under 40% context. Push ONCE; last commit subject ends `[worker-done <ticket>]`.

## Why
Owner goal: 10 real organisers claim their page and update an event themselves. This walk lists where an organiser who lands on an unclaimed page gives up. Do NOT redo the invite-link join screens: PR #1303 (`claude/walk-invite-recheck-1`) owns "invite first-minute recheck". Start where it ends: the person is signed in and looking for or opening a page to claim.

## What main lacks
- a ranked dead-end report for find-and-claim, file:line per dead end, scored "would an organiser give up here" -- docs/handover/walk-claim-find-claim.md
- (optional) one phone spec that drives GateSheet and ClaimNotice states on fake Supabase and saves 390x844 pictures with the existing helper -- tests/e2e-phone/walk-claim-find-claim.spec.ts

## Files
- docs/handover/walk-claim-find-claim.md
- tests/e2e-phone/walk-claim-find-claim.spec.ts (only if no existing spec drives the state)

## Do
1. Read: `src/modules/organiser/home/ClaimNotice.tsx`, `src/modules/organiser/p3/onboarding/GateSheet.tsx`, `GateHost.tsx`, `gateModel.ts`, `gateRule.ts`, `OnboardingFlow.tsx`. List every state a claimer can meet (unclaimed page found, already claimed by someone else, request pending, declined, no page found, read failure).
2. Run the existing evidence: vitest `src/modules/organiser/p3/onboarding/__tests__/` and `src/modules/organiser/home/__tests__/ClaimNotice.test.tsx`; phone specs `tests/e2e-phone/invite-w2-walk.phone.spec.ts` and `invite-w2-golive.phone.spec.ts` (fake Supabase, 390x844, wait for heading text, never networkidle). Open every picture before writing about it; a green test is not a pass.
3. Prod SHAPES, counts only: organisers by claimed / unclaimed / claim-pending; how many unclaimed pages carry live events.
4. For each dead end: file:line, the words on screen (quoted), what the person CAN do next (one action?), rank worst first (max 10) by "would an organiser give up here".
5. End with a coverage count: N states read, N driven by a test or picture, N only read in code.

## Not verified (write this block honestly)
Real sign-in, the real email/claim link, a real phone, real prod accounts. Everything is fake-Supabase or code reading.

## Hard rules
Do not edit `src/**` or touch `claude/walk-invite-recheck-1`. No `run-ci`. Handover line `DONE [worker-done <ticket>]`.
