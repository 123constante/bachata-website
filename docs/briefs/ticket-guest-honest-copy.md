# Brief: ticket screens say where a ticket really is -- email only for guests, My tickets for signed-in buyers

Brief-version: 2
Repo: Website. Branch: claude/ticket-guest-honest-copy. Lane: normal, Sonnet. No database call added.

## What main lacks
- A signed-in buyer whose order is NOT linked to their account (bought before signing in, or the read failed) sees "Your tickets are in your email, and in My tickets." (src/modules/tickets/OrderQrBlock.tsx line 35, testid order-qr-email). It is false: `my_tickets_v1` returns only orders with buyer_user_id = the caller and never links a guest order by email (admin migration 20270314050000 header). The link then shows "No tickets yet" -- grep: keep your tickets in My tickets
- The checkout form never tells a signed-out buyer their tickets come by email only. Only the My tickets empty state says "Tickets you buy while signed in show here" (myTicketsModel.ts line 155). The sole hint is the label "Email (your tickets are sent here)" (TicketsBlock.tsx line 408). -- grep: keep your tickets in My tickets
- extends: Already on main, keep: the signed-out thank-you page makes no My tickets promise (OrderQrBlock mounts only when `user` is set, TicketThanksPage.tsx line 105). -- src/modules/tickets/OrderQrBlock.tsx

## Files
src/modules/tickets/OrderQrBlock.tsx, src/modules/tickets/myTicketsModel.ts (one shared words object for the three lines), src/modules/tickets/TicketsBlock.tsx (one note under the email field, signed-out only), src/modules/tickets/__tests__/orderQr.test.tsx, new src/modules/tickets/__tests__/ticketWhere.matrix.test.tsx, docs/design/ticket-guest-honest-copy.md. Leave alone: ticketCheckoutModel.ts reasons, legalCopy.ts, TicketsBlock promo code.

## What to build
1. In OrderQrBlock split the "email" view into `empty` (reply ok, zero tickets: "Your tickets are in your email.", no My tickets claim) and `error` ("We couldn't load your door codes just now. Your tickets are in your email. You can also try My tickets in a minute." with the existing 44px My tickets link). `cards` unchanged.
2. TicketsBlock: when not signed in (useAuth user null, authStatus settled) show under the email field: "You are not signed in, so your tickets come by email only. Sign in first to keep them in My tickets." plus a 44px "Sign in" link from `buildSignInHref` returning to the same event path and query (a promo ?code= must survive). Signed in or auth resolving: no note.
3. Table test, RED FIRST (new rows fail on unchanged code): {signed out, auth resolving, signed in} x note shown or not; {cards, empty, error, loading} x exact text. Assert no copy names My tickets without a link to it on the same screen.
4. Design record: copy only, ONE chosen wording plus two rejected (two lines each).

## Out of scope
No linking of guest orders by email (needs a database and privacy decision), no change to checkout or the thank-you title. Walk /event/<live id> signed out and signed in, and /tickets/thanks?o=<order>, at 390x844 (the note must not push Buy off a sensible position; report it if it does).
Hand-off: Verified / Not verified block; design record linked in the PR body.
