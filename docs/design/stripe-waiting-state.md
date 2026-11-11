# Design record: stripe-waiting-state (ticketing S2, gap G2)

`stripeStateOf` (ticketModel.ts) now separates **started** (a Stripe row, `details_submitted` not true: Stripe still needs details) from **waiting** (`details_submitted` true, `charges_enabled` not true: Stripe is checking). Every screen reads that one mapping and `STRIPE_COPY.waiting`.

Waiting copy: Stripe is checking the details, usually quick, you can sell as soon as it is done. Actions: **Check again** (refetch the account status) and a plain **Open Stripe** text link. Never "Finish connecting" / "Carry on with Stripe". Put on sale stays disabled for paid tickets with `STRIPE_WAITING_REASON`; free tickets are unaffected.

## Inventory

| # | Screen / state | File | Waiting behaviour | Covered |
|---|---|---|---|---|
| 1 | The one mapping | tickets/ticketModel.ts `stripeStateOf`, `STRIPE_COPY` | new state | yes |
| 2 | Move reason | ticketModel.ts `moveBlock` | `STRIPE_WAITING_REASON` | yes |
| 3 | Connect block (`connectBlock`) | ticketModel.ts | kind `check`, Check again | yes |
| 4 | Add a ticket step 3 | p3/tickets/TypeSheet.tsx | reason, disabled Put on sale, Check again, Open Stripe | yes |
| 5 | Draft row | p3/tickets/TicketsEntry.tsx `TypeRow` | same block | yes |
| 6 | Return banner (return, refresh) | ticketModel.ts `connectReturnBanner`, TicketsEntry.tsx | `waiting` banner after the 30 s poll; poll unchanged | yes |
| 7 | Get paid screen | p3/tickets/GetPaid.tsx `GetPaidBody` | waiting card, Check again, Open Stripe | yes |
| 8 | Get paid start screen | GetPaid.tsx `startView` | primary check, secondary Open Stripe | yes |
| 9 | Home prompt | GetPaid.tsx `Prompt`, model.ts | waiting words, same two actions | yes |
| 10 | You > Get paid row tag | model.ts `getPaidRowTag` | "Stripe is checking" | yes |
| 11 | nextStep / paymentsLink | ticketModel.ts | waiting-aware (no screen draws them yet) | model only |

Coverage: 11 of 11. Tests: p3/tickets/__tests__/stripeWaiting.matrix.test.tsx (red on the unfixed code, 16 failing).
Out of scope: DB/RPC/edge functions (we cannot say what Stripe still needs), the public event page.
