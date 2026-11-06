# Design record: ticket promo codes, buyer half

Ticket dt_4a6cf3b57af7. Brief: `brief/ticket-promo-codes-web:docs/briefs/ticket-promo-codes-web.md`.

## What the buyer sees
A "Promo code (optional)" field on the event page Tickets block. It sits under the totals and only shows for a paid ticket, because a free ticket has nothing to take off. It is one row: a text input (upper-cased, 16px so iOS does not zoom) and an Apply button (44px tall). A note line sits under it.

- **Apply** calls `ticket_promo_preview_v1`. If the code is valid, a "Promo code CODE: -£x" line appears in the totals, the Total becomes the server total, and the note reads "Code CODE applied. You save £x." (or "Your tickets are free."). Apply turns into **Remove**.
- **Refused**: the note shows the owner's copy for that reason, and the code stays in the field. Buy is held with "Remove the promo code or try a different one.", and a "Clear the code and pay the full price" link sits under the field.
- **Checking**: Apply reads "Checking…" and is disabled, and Buy is held with "Wait while the promo code is checked.". A double tap or Return sends one preview only.
- **`?code=`** pre-fills the field and never applies on its own. Buy is held with "Tap Apply to check your promo code, or clear it.".
- **Changing the ticket or the count** re-prices the code straight away. Only the newest reply counts.
- **Free result**: Buy reads "Get free tickets". The edge's `{ok, order_id, free:true}` goes to the existing free thank-you end state.
- **Checkout 409** with a code reason goes back into the code field, not the general alert.

## One shared mapping
`src/modules/tickets/promo.ts`: `PROMO_REASON_COPY` (the admin handover table, word for word) and `promoView(state, input, key)`. The block reads only these. Every row of the state table is tested in `__tests__/promo.matrix.test.tsx`.

## State table (buyer)
| State | Note | Apply | Buy | Sent |
| --- | --- | --- | --- | --- |
| no code | none | tappable (empty tap: "Type a code first, then tap Apply.") | as before | nothing |
| typed, not applied / `?code=` | none | tappable | held: tap Apply or clear | nothing |
| checking (slow, double tap) | Checking the code… | disabled, "Checking…" | held: wait | nothing |
| valid percent / fixed | applied, you save £x / 50p | becomes Remove | open | `promo_code` |
| free result | applied, tickets are free | Remove | "Get free tickets" | `promo_code` |
| choice changed, re-price lost | Tap Apply to update | tappable | held | nothing |
| unknown_code / inactive / expired / used_up / not_for_this_event / no_discount / below_minimum | owner copy | disabled until the code changes | held: remove or change | nothing |
| rate_limited / offline / timeout | owner copy / check connection | tappable again | held | nothing |
| free ticket picked | no field | n/a | open | nothing |

## Choices
- Pricing on the screen comes from the server only. The client never computes a discount.
- `rate_limited` from checkout (HTTP 429) is ambiguous between the checkout limiter and the code limiter, so it stays the existing checkout copy.
- No effect-driven re-pricing (`react-hooks/set-state-in-effect`). The stepper and type buttons re-price, and any other route to a changed choice falls back to "Tap Apply to update" with Buy held. That fallback never charges a stale price.
