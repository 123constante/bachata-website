# Brief P119: Get paid returnTo follow-ups (Website, UI fix)

Brief-version: 2
Size: 2 files, 150 lines. Design: none (same back link as #2515 on two more states).
Branch: `claude/p119-getpaid-nits`. One PR. No switch.

## What main lacks
- GetPaid.tsx accepts a returnTo that points at Get paid itself (`/account/p3/you/get-paid...`), drawing a back link to the same screen. -- grep: isGetPaidPath
- extends: GetPaid loading and error states show no back link when returnTo is set, so an organiser stuck there has no way back to the event. -- grep: tix-getpaid-back-to
- extends: getPaidReturnTo.matrix.test.tsx: stripe-delete case does not assert `stripe` is gone; round-trip case uses toContain where the exact URL is known. -- grep: getPaidReturnTo

## Files
- src/modules/organiser/p3/tickets/GetPaid.tsx (edit)
- src/modules/organiser/p3/tickets/__tests__/getPaidReturnTo.matrix.test.tsx (edit)

## What to build
0. Write INVENTORY.md first (it exists in the repo: replace its body with this job's notes, do not ship it): every GetPaid state (loading, error, none/started/waiting/connected) x returnTo shape, with file:line. Report the coverage count at the end.
1. Add `isGetPaidPath(path)` in GetPaid.tsx: true when the path (before `?`) is the Get paid route (`P3_TICKET_PATHS.getPaid()` base). Such a returnTo is treated as no returnTo (no back link, onboarding URLs unchanged).
2. Draw the same back link (text link form, `data-testid="tix-getpaid-back-to"`, 44 px min height in px) on the loading and error states when a safe returnTo is set.
3. Tests: assert `stripe` param absent after the arrival effect; use toBe on the exact return/refresh URLs; add self-path case; add loading and error cases.
Run the new tests against the unfixed code first and say they fail.

## Prod shape
Organisers on Get paid: none/started/waiting/connected Stripe states; owner vs non-owner.

## Done
- Every CI job step that applies (test:unit for src/modules/organiser/p3/tickets, typecheck, lint chain) run, results in the PR body.
- PR body from the repo template, "Verified on real data" block filled, honest "Not verified".
- Handover in PR body: head SHA, checks per job.
