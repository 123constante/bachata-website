# Inventory: the buyer's short door code (ticket-buyer-short-code-web)

Written BEFORE the build, per the brief. Code read at `origin/main` 900a4d5. Live RPC
bodies and counts read from prod `stsdtacfauprzrdebmzg` on 2026-11-06, SELECT only, counts
only, no personal data. The admin repo (`bachata-admin-11april`) is not attached to this
session, so admin rows cite the live database objects it created instead of admin file:line.

Legend: **Covered** = this branch shows or honours it, with the test that proves it.
**N/A** = out of this brief's scope (stated why).

## A. Admin app / database (schema authority)

| # | Field / state / option | Where (live object) | Status |
|---|---|---|---|
| A1 | `tickets.short_code text NOT NULL` | `src/integrations/supabase/types.ts:8434` (generated), prod column | Covered: parsed as `shortCode` |
| A2 | Alphabet `23456789ABCDEFGHJKMNPQRSTUVWXYZ`, length 6 | `_ticket_short_code_new_v1` (`types.ts:11126`); mirrored `src/modules/organiser/p3/door/model.ts:185` `SHORT_CODE_RE` | Covered: the parsers reuse `SHORT_CODE_RE` (one alphabet) |
| A3 | `my_tickets_v1` row key `short_code` | live body: `'qr_token', s.qr_token, 'short_code', s.short_code,` | Covered: `parseMyTickets` |
| A4 | `my_ticket_order_qr_v1` row key `short_code` | live body: `'qr_token', t.qr_token, 'short_code', t.short_code,` | Covered: `parseOrderQr` |
| A5 | `checked_in` = `checked_in_at IS NOT NULL OR status = 'used'` | both live bodies | Covered: greyed code + "Checked in" |
| A6 | Void tickets: `t.status <> 'void'` in both RPCs | both live bodies | Covered: server hides them; test asserts a reply without them renders no extra card |
| A7 | Prod shapes: valid/unchecked/code ok = 4; void/unchecked/code ok = 4; void/checked/code ok = 1; null codes = 0; malformed = 0 | SELECT on `tickets` (counts) | Covered: matrix also covers null / lowercase / malformed / missing key for old replies |
| A8 | Door check by code `ticket_check_in_by_code_v1` (rate-limited 20 / 15 min) | `src/modules/organiser/p3/door/data.ts:53`, `model.ts:15` | N/A (organiser door screen, not touched) |
| A9 | Ticket email wording carrying the code | admin repo (not attached) | N/A: brief says the email wording stays as it is; not changed here |

## B. Website today

| # | Field / state / option | file:line | Status |
|---|---|---|---|
| B1 | `MyTicket` model (no short code) | `src/modules/tickets/myTicketsModel.ts:18-31` | Covered: `shortCode: string \| null` added |
| B2 | `parseMyTickets` token handling | `myTicketsModel.ts:58,68` | Covered: same defensive style for the code |
| B3 | `OrderQrTicket` + `parseOrderQr` | `myTicketsModel.ts:181-202` | Covered: `shortCode` added; a bad code never drops the row |
| B4 | My tickets card: QR box | `src/modules/tickets/MyTicketsPage.tsx:74-81` | Covered: code line under the QR area |
| B5 | My tickets card: checked-in tag + "Show anyway" | `MyTicketsPage.tsx:47-51,63-71` | Covered: code greyed with "Checked in" |
| B6 | My tickets card: collapsed QR ("Show QR code") | `MyTicketsPage.tsx:82-91` | Covered: code line shows whether or not the QR is open |
| B7 | My tickets card: no QR (`QR_MISSING`) | `MyTicketsPage.tsx:61-62` | Covered: code still shows when valid (it is the fallback) |
| B8 | Past section (QR collapsed) | `MyTicketsPage.tsx:113` | Covered: same card, same rule |
| B9 | Thank-you QR card | `src/modules/tickets/OrderQrBlock.tsx:251-263` | Covered: code line under the QR |
| B10 | Thank-you checked-in tag | `OrderQrBlock.tsx:254-258` | Covered: code greyed with "Checked in" |
| B11 | Thank-you empty / error / loading / "and N more" | `OrderQrBlock.tsx:230-244,266-271` | Covered: unchanged, no code text (test) |
| B12 | Door short-code flag `ticketDoorCode` (`VITE_ENABLE_TICKET_DOOR_CODE`, OFF in prod per `docs/handover/ticket-door-code-screen.md:10`) | `src/modules/organiser/p3/door/doorFlags.ts:10` | Covered: the buyer code shows only when the door can accept it (flag on); off = treated as null |
| B13 | Never log / store the secret | `myTicketsModel.ts:6-7`, `OrderQrBlock.tsx:10` | Covered: no logging added; DOM test asserts no token, code only as the grouped text |
| B14 | Door placeholder "K7M 2QX" grouping | `src/modules/organiser/p3/door/DoorScreen.tsx:330` | Covered: same grouping via one formatter `formatShortCode` |

## C. Public page

| # | Field / state / option | file:line | Status |
|---|---|---|---|
| C1 | Thank-you page order reference (mono) | `src/modules/tickets/TicketThanksPage.tsx:102` | Covered: code uses the same mono style |
| C2 | Thank-you renders `OrderQrBlock` only when paid + signed in | `TicketThanksPage.tsx:107` | Covered: existing test kept green |

**Coverage: 21 / 23 covered, 2 N/A (A8 door screen, A9 email; both out of scope by the brief).**
