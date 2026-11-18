# Website: ticketing client clock, ?o= fallback, notYouErr (flag OFF, normal lane)

Repo: Website. One branch, one PR, bot-authored (no MCP create_pull_request; push, the bot workflow opens the PR).
Everything stays behind the existing flags (`publicTicketing`, `BUYER_ONBOARDING_ENABLED`). Flag-off behaviour must not change (keep `src/modules/tickets/__tests__/flagOff.test.ts` green).
No DB change. No visual change: copy stays as it is.

## Three fixes (each: reproduce with a failing test first)

1. Client clock (R2-N1). `src/modules/tickets/MyTicketsPage.tsx` passes `today={londonTodayKey()}` (device clock). A phone with a wrong date or timezone puts tonight's ticket in Past, or hides the QR. Make "today" robust: derive it once per load from the server clock (the `Date` response header of the my_tickets fetch, or an existing server-time helper if one exists; grep first), fall back to the device clock only if neither is available. Same helper for `useTicketCard` (`upcomingCardTickets(..., londonTodayKey())`).
2. `?o=` fallback (R2-N2). `src/modules/dancer-app/screens/tickets/useTicketCard.ts`: when the URL has no `?o=` and nothing is stored, the card shows "none" even if the person has upcoming tickets only via a deep link or email button. Confirm the link the emails use (`/account/my-tickets?o=<order_id>`) lands correctly on both pages, with and without sign-in, and that a missing, malformed or foreign `?o=` falls back to the person's own upcoming tickets instead of an error. Add tests for each case.
3. notYouErr (R2-N3). `src/modules/tickets/TicketPickerB1.tsx` (~line 82 and 307): read the code, find why the "not you" error state can stick or show wrongly (stale after retry, after sign-out, flag off), fix it, test it.

Also fix the reminder link nit if it is in this repo: any `/my-tickets` link should be `/account/my-tickets` via one shared constant (`MY_TICKETS_PATH`).

## Done means
`npm run pre-ship` green, unit tests added and passing, PR description lists what was reproduced and what was not.
