# Ticket thank-you page: "Confirmed" (design record)

Wording plus one state card; the existing `tickets-thanks` section styling is reused (no new layout).
Mapping lives in `thanksCopy` (`ticketCheckoutModel.ts`), one copy for every state.

| Server status | Title | Notes |
|---|---|---|
| paid | Confirmed. Your tickets are in your email. | body adds ticket count, event title/date when present |
| pending / retry_later | Checking your order | polls at 2, 4, 8 s then 15 s, at most 8 polls |
| (poll cap reached) | Still processing | "check your email in a few minutes", link reads "Back" |
| failed | Payment didn't go through | link back to what's on |
| unknown / no order / error | Checking your order (today's neutral copy) | never says Confirmed |

Free orders read the same way. Only `paid` may say Confirmed.
Known gap: the RPC returns no event id, so the failed state links to the homepage, not the event.
