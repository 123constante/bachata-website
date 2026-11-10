# Design record: getpaid-next-action (ticketing S4, gaps G5 + G6)

One return handler, `useConnectReturn` (p3/tickets/connectReturn.ts): refetch on a Stripe return, poll every 3 s for 30 s, stop on connected or unmount; "Check again" restarts it. One next step, `nextTicketTarget`: one live event opens its Tickets sheet (`P3_TICKET_PATHS.eventTickets`, `?tickets=1`); several events or none live go to the events list with the reason; no events at all go to Create with "You need an event first". The "reload the page" copy is gone from every Connect landing and from the loading reason in `moveBlock`.

## Inventory

| # | Entry point / landing | File | Behaviour now | Covered |
|---|---|---|---|---|
| 1 | Shared handler | tickets/connectReturn.ts `useConnectReturn` | refetch + 3 s / 30 s | yes |
| 2 | Shared next step | connectReturn.ts `nextTicketTarget` | sheet / events+reason / create+reason | yes |
| 3 | You > Get paid (return, refresh, none) | GetPaid.tsx `GetPaidBody` | shared handler; Add a ticket when connected; no reload copy | yes |
| 4 | Home prompt (lands on #3) | GetPaid.tsx `Prompt` | returns to #3 | yes (via #3) |
| 5 | Start screen | GetPaid.tsx `StartBody` | shared handler (was 60 s, own copy); Add a ticket opens the sheet | yes |
| 6 | Tickets sheet banner | TicketsEntry.tsx | shared handler (was its own timer) | yes |
| 7 | Loading reason | ticketModel.ts `moveBlock` | "Try again in a moment." | yes |

Coverage: 7 of 7. Tests: p3/tickets/__tests__/getPaidNextAction.matrix.test.tsx (22 failing on the unfixed code). Out of scope: DB/RPC/edge, public event page, S2 mapping.
