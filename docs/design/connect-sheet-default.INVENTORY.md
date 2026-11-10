# Inventory: connect-sheet-default

Source audit: `claude/walk-ticket-connect-flow` (docs/walk/ticket-connect-flow/RESULTS.md and INVENTORY.md, base 502dddf). Admin app not read; only the names the Website calls. Lines are on origin/main 502dddf before this slice.

| # | Item (screen / state) | Before | This slice | Covered |
|---|---|---|---|---|
| 1 | Add a ticket step 1 price | no Stripe word (TypeSheet.tsx:295) | `STRIPE_AT_PRICE_HINT` under a paid price | yes |
| 2 | Step 3 Connect block, none/started | TypeSheet.tsx:215-229 | unchanged button; link + error added | yes |
| 3 | Step 3 external link | absent | `SELLING_ELSEWHERE_LINK`, text link to Details | yes |
| 4 | Step 3 start error | not drawn (B2.12) | drawn under Connect | yes |
| 5 | Step 3 switched off | plain text `PAYMENTS_WHERE` (ticketModel.ts:218) | link to Get paid | yes |
| 6 | Step 3 series not live / connected / free | Put on sale or its reason | unchanged | yes (matrix) |
| 7 | Draft row Connect block | TicketsEntry.tsx:607-615 | link added; error already shown | yes |
| 8 | Draft row switch reason | text | `ReasonText` link when payments missing | yes |
| 9 | Return banner `stripe=return` | TicketsEntry.tsx:421-439 | start error shown in banner | yes |
| 10 | Banner `stripe=refresh` | silent (TicketsEntry.tsx:158) | `STRIPE_REFRESH_NOTE` + Carry on with Stripe | yes |
| 11 | Stale comment "Stripe tickets come later" | sheets.tsx:132 | replaced | yes |
| 12 | Banner connected states | ticketModel.ts:289-301 | unchanged | n/a, no change |
| 13 | Get paid screens, public page, started split, polling | B4, C | out of scope (S2, S4, S1) | not in slice |
| 14 | Details "Ticket link" field | DetailsScreen.tsx:155-158 | target of the link, unchanged | n/a |

Coverage: 11 of 11 in-slice rows covered; 3 rows named out of scope or unchanged.
