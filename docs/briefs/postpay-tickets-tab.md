# Brief: post-pay lands on the Tickets tab (option A)

Owner pick 2026-11-19 (DESIGN-REGISTRY row "Post-pay screen", artifact https://claude.ai/artifact/J2W6tti18ppNkkE3Jk2Whz, option A). Owner said "build this".

## Goal
After Stripe return, a signed-in buyer lands on `/app/tickets?o=` (not `/app/home`), and that tab matches option A.

## Spec A (top to bottom)
1. "You're booked" bar. Processing variant (order not yet paid-confirmed): spinner + event name.
2. Ticket card with QR + pager (several tickets in the order).
3. Gold "Finish your profile" bar (existing `tickets-finish-bar`, only when profile incomplete).
4. Blurred, locked Home picture (already exists in TicketsScreen).
5. `AccountLinkPanel` ("Have tickets under another email?") and linked accounts move from Tickets tab to the Me tab.

## Decisions (owner delegated)
- One ticket = whole-day pass. Card shows event + date only. No per-class tickets.
- Door = one check-in per day (single checked_in flag). Do NOT read or change the real door scan code.

## Code
- `src/modules/tickets/TicketThanksPage.tsx`: the flag-ON redirect to `DANCER_HOME_PATH` becomes `DANCER_TICKETS` (keep the local copy of the path; tickets module may not import dancer-app, check-dancer-area-isolation rule c). Signed-out fallback unchanged.
- `src/modules/dancer-app/screens/tickets/` (TicketsScreen, TicketCard, useTicketCard, model.ts). Shared status map: `src/modules/tickets/ticketCardStatus.ts`.
- Behind a NEW build flag (follow `src/lib/buyerOnboardingFlag.ts` pattern, default OFF; flag OFF = exactly today). Rollback = flag off.
- Update shell comment in `src/modules/dancer-app/shell/DancerAppRoutes.tsx` (~line 58) if the Home redirect logic interacts.

## Rules
- Read the repo CLAUDE.md. HTML entities in JSX. Explicit px tap targets (html font-size trap). Large source files via scripts/safe-edit.py.
- Tests: table-driven vitest, flag ON and OFF, paid and processing orders, 1 and 3 tickets, free=1.
- Run the CI steps that apply locally (`npm run pre-ship`). Walk at 390x844 with a PAID-mocked order (mock id must match the order read). Screenshots in the PR.
- One branch, one PR. PR body needs the "Verified on real data" block with an honest "Not verified".
