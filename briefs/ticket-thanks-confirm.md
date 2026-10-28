# Brief: ticketing - thank-you page shows "Confirmed" (Website half)

Lane: NORMAL (no DB change in this repo). Model: Sonnet. Repo: Website `123constante/Website`. Branch `claude/ticket-thanks-confirm`. Behind the existing `publicTicketing` flag (the route already is).

## Goal
`/tickets/thanks` (`src/modules/tickets/TicketThanksPage.tsx`) holds an order id (`?o=`) but only ever says "Checking your order" (`thanksCopy(free, 'checking')` in `ticketCheckoutModel.ts`). The admin PR `claude/ticket-thanks-read` (admin #1105, applied before this merges) adds RPC `public.ticket_order_public_status_v1(p_ref text) -> jsonb` `{status, ticket_count, event_title, event_date, retry_later?}`, status one of `paid | pending | failed | unknown`. Use it.

## Build
- `ticketCheckoutApi.ts`: `readOrderStatus(orderId)` calling `supabase.rpc('ticket_order_public_status_v1', { p_ref })` as a normal POST (the function is VOLATILE; never a GET/head call). Validate the response shape; anything odd = `unknown`.
- Page states (one shared mapping in `ticketCheckoutModel.ts`, `thanksCopy` extended, no second copy): `paid` -> "Confirmed. Your tickets are in your email." (+ ticket count, event title/date when present); `pending` -> keep "Checking your order", poll every 3 s up to ~60 s then a calm "still processing, check your email in a few minutes" with a Back link; `failed` -> "Payment didn't go through" + a way back to the event; `unknown` / no order / network error -> the current neutral copy (never say Confirmed); `retry_later` -> back off, treat as pending. Free orders (`free=1`) read the same way.
- Stop polling on unmount. No new dependency. Order id never logged or sent anywhere except the RPC.
- Until the RPC is applied in prod, the call returns an error: that MUST degrade to today's behaviour (test it).

## Verify (Definition of done)
Table-driven vitest: every status x free/paid x no-order x error x retry_later x poll timeout, copy never says Confirmed unless `paid`. Prove the data source first (read the RPC body on the admin branch; do not call prod). `npm run check:bundle-budget` main vs branch: +0 bytes to dancer-app first load. 390x844 e2e: card, links and tap targets inside the viewport, text visible. Every CI job step run, per-job table + Verified / Not verified in the PR body. One independent review, one fix round, then the orchestrator walk.

Design: wording + one state card only, reuse the existing section styling; design record `docs/design/<pr>.md` (short) linked in the PR.
