# thank-you-qr-web (Website, BUILD-visual, small; normal lane; Sonnet, medium). Show the buyer's door QR on the paid thank-you page.

Brief-version: 2
Lane: Website, normal. Model: Sonnet, medium. Branch: `claude/thank-you-qr-web`.
Serves: PRIORITY-QUEUE owner click Q9 (2026-11-04): "My tickets page PLUS thank-you page QR". The admin half `my_ticket_order_qr_v1` is MERGED AND APPLIED on prod (admin #1222, 2026-11-04 19:23Z). The My tickets page (#1334) and its entry points (#1344) are on main.

Context line: stay under 50% of your context; early checkpoint push (`[skip preview]`), push + handover by 50%. Never approve/merge/--no-verify. Plain git only. Supabase READ-ONLY (SELECT; you will barely need it). No migration. Never end a turn on a background task. Source files over 2 KB go through `scripts/safe-edit.py` / `scripts/safe-write.py`. Use HTML entities, not raw Unicode punctuation, in JSX.

## What main lacks
- The paid thank-you page shows no QR: for `state === 'paid'` it renders only the copy, the order reference, a "See your tickets" link (signed-in only) and "Back to what's on". The buyer must open My tickets to find the door code. -- extends: src/modules/tickets/TicketThanksPage.tsx
- No client for the new RPC. `my_ticket_order_qr_v1(p_order_id uuid) -> {"tickets":[{ticket_id, ticket_type_name, qr_token, checked_in}]}` is applied on prod (EXECUTE authenticated only; signed out raises 42501; any non-match, guest order, other user, not paid or paid more than 2 hours ago returns `{"tickets": []}`). The only ticket reader today is `fetchMyTickets` (`my_tickets_v1`, no args). -- extends: src/modules/tickets/myTicketsApi.ts
- The QR drawing lives inside `MyTicketsPage.tsx` as a private `QrCode` component (SVG from `qrModules`/`qrPath`); the thank-you page cannot reuse it without importing the whole My tickets page. `qr.ts` is deliberately imported only from lazy chunks. -- extends: src/modules/tickets/MyTicketsPage.tsx
- `flagOff.test.ts` pins which files may import `qr.ts` so the generator never lands on a first load; a new importer must be added to that list on purpose, and the thank-you page must load the QR lazily. -- extends: src/modules/tickets/__tests__/flagOff.test.ts
- The guest case: a guest buyer (`buyer_user_id` null) or a signed-out visitor gets no QR from the server by design; today the copy says "Your tickets are in your email." and that stays the truth for them. -- extends: src/modules/tickets/ticketCheckoutModel.ts

## Files
- NEW `src/modules/tickets/TicketQrCode.tsx` (the shared QR drawing, moved out of MyTicketsPage; default export; imports `./qr`)
- `src/modules/tickets/MyTicketsPage.tsx` (replace its private `QrCode` by an import of the shared one; no other change; its tests must pass unmodified)
- `src/modules/tickets/myTicketsApi.ts` (add `fetchOrderQr(orderId)`; do not change `fetchMyTickets`)
- `src/modules/tickets/myTicketsModel.ts` (add `parseOrderQr` and its types only)
- `src/modules/tickets/TicketThanksPage.tsx` (a lazy `OrderQrBlock` shown only when `state === 'paid'` AND signed in AND `orderId`)
- NEW `src/modules/tickets/OrderQrBlock.tsx` (calls `fetchOrderQr`, renders each ticket's QR, handles every reply)
- tests: NEW `src/modules/tickets/__tests__/orderQr.test.tsx`; extend `src/modules/tickets/__tests__/flagOff.test.ts` and `src/modules/tickets/__tests__/orderStatus.test.tsx`
- `docs/handovers/thank-you-qr-web.md`
Nothing else. No route, no package, no migration. Do NOT touch `thanksCopy` strings that exist today, `ticketCheckoutApi.ts`, the density-exempt calendar files, or any admin file.

## What to build (tests first, red on main; say so)
1. `fetchOrderQr(orderId)`: untyped rpc boundary exactly like `fetchMyTickets`; `{kind:'ok', tickets}` / `{kind:'signed_out'}` (42501) / `{kind:'error'}`. Never log the reply or error body (it carries qr_tokens).
2. `parseOrderQr(data)`: accepts only `{tickets: [...]}`; each ticket needs a string `ticket_id`, string `ticket_type_name`, boolean `checked_in`, and `qr_token` a 64-hex string; any other row is dropped; a malformed envelope is an error.
3. `OrderQrBlock` (lazy, `React.lazy`/`lazyWithRetry` like the other tickets chunks): on mount, one call. States, each with a testid and copy that says what the person CAN do:
   - loading: "Getting your door codes&hellip;" (no QR yet);
   - tickets (1..100): one card per ticket, ticket type name, the QR in a white box (`min` 44px touch not needed, QR box as My tickets uses), and a "Checked in" tag when `checked_in`;
   - empty (`[]`) or `signed_out` or error: "Your tickets are in your email, and in My tickets." with the existing My tickets link (do not duplicate the link that already shows for signed-in paid state; show the sentence only). Never say the order is missing;
   - more than 8 tickets: show the first 8 and a line "and N more in My tickets" linking to My tickets.
4. Thank-you page: render `OrderQrBlock` only for `state === 'paid' && user && orderId`. Guests and signed-out: nothing new. Do not delay or change the existing copy, the polling or the links. Order of elements: copy, order reference, QR block, "See your tickets", "Back".
5. Privacy: the `qr_token` stays inside `TicketQrCode`/`OrderQrBlock` state; not in the URL, not in a data attribute, not in `localStorage`/`sessionStorage`, not in any log, not in an error message. A test greps the rendered DOM (attributes and text) for the 64-hex token and finds it only inside the SVG path data derivation, never as text or attribute.
6. `flagOff.test.ts`: while `publicTicketing` is off nothing changes (the route renders NotFound); add the two new files to the allowed `qr.ts` importers; add a check that `TicketThanksPage.tsx` imports `OrderQrBlock` only through a lazy import (no static import).

## Tests (table-driven; red against main; say counts red then green)
Reply shapes x page states: reply in {1 ticket, 3 tickets, 9 tickets (cap 8 + "and 1 more"), `[]`, signed_out 42501, other error, malformed rows, checked_in true} x state in {paid+signed-in, paid+signed-out, checking, processing, failed, none}; QR block appears only in paid+signed-in. Free order (`free=1`) paid+signed-in shows the QR too. Loading state first. The same QR component is used by MyTicketsPage (its existing tests pass unmodified). Token never appears as DOM text/attribute. One call per mount (no repeat polling for QR).

## Run before you push (read `.github/workflows`; say the result of each)
`npx vitest run src/modules/tickets`, `npx tsc --noEmit`, `npm run lint`, `npm run build` then `npm run check:bundle-budget` (the generator must stay out of the first-load chunks), `npm run check:mojibake`, the architecture guards that apply to `src/modules/tickets`.

## Real-data check (read-only on prod, counts only; paste in the handover)
Today there is no order paid within the last 2 hours (admin handover 2026-11-04), so the live answer is `[]` and a real QR cannot be exercised on prod. Say so under Not verified; the owner or orchestrator walks a real just-paid order in the ticket preview walk (TICKET_PREVIEW_ORIGIN, fee=0), per the go-live order.

## Phone QA (orchestrator walks; the worker does not need a browser)
390x844 and 320x568, signed in, paid order, with 1, 3 and 9 tickets from a mocked reply: QR box fully on screen, no sideways scroll, 44px targets for the links, empty and error states readable.

## Hard limits specific to this brief
- No change outside the Files. No admin or migration work. Do not widen the 2 hour rule or request more than the RPC returns.
- Do not touch the density-exempt calendar files.

## Done when
New tests red then green, `src/modules/tickets` tests, tsc, lint, build, bundle budget and guards green, one final push, handover with Verified / Not verified (including: a real just-paid order not exercised).
