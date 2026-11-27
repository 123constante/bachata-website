# Brief: show the short door code on My tickets and the thank-you page (held until the database change is applied)

Brief-version: 2
Branch: claude/ticket-buyer-short-code-web
Lane: normal, Sonnet. Website repo, src/modules/tickets only. Must not touch the organiser door screen, the calendar density-exclusion files or generated Supabase types by hand. HOLD: dispatch only after claude/ticket-buyer-short-code-db is merged and applied.
Serves: ticket buyers at the door when a QR will not scan.

## What main lacks
- the ticket model carries qrToken but no short code, so no screen can show it -- grep: buyerShortCode
- the thank-you page QR block shows each QR with no readable code under it -- grep: data-testid="order-qr-short-code"
- My tickets cards show a QR with no readable code under it -- grep: data-testid="my-ticket-short-code"
- extends: parseMyTickets and parseOrderQr must accept a short_code and treat a missing or malformed one as null (old replies still render) -- src/modules/tickets/myTicketsModel.ts

## Files
- src/modules/tickets/myTicketsModel.ts
- src/modules/tickets/MyTicketsPage.tsx
- src/modules/tickets/OrderQrBlock.tsx
- src/modules/tickets/__tests__/myTickets.matrix.test.tsx
- src/modules/tickets/__tests__/orderQr.test.tsx
- docs/design/ticket-buyer-short-code.md (new)

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. Parse short_code (exactly 6 characters from 23456789ABCDEFGHJKMNPQRSTUVWXYZ, upper-cased) in both parsers; anything else becomes null.
2. Under each QR on My tickets and on the thank-you page, show "Door code" and the code in two groups of three ("K7M 2QX"), monospace, tap target at least 44px if it is tappable, no sideways scroll at 390x844. Checked-in tickets show the code greyed with "Checked in".
3. When the code is null, show no code line and no text that points at it; the QR and the email wording stay as they are.
4. Never log the code or the reply.

## Tests
Table-driven, red first: reply shape (with code, null, lowercase, malformed, missing key) x screen (My tickets, thank-you) x ticket state (valid, checked in, void hidden). One shared formatter for the grouping.

## Done when
Walked at 390x844 on a prod-shaped account (one order with 3 tickets, one checked in), screenshots in the PR, Verified / Not verified block, design record linked.
