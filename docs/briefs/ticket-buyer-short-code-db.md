# Brief: buyers see their short door code (database and ticket email)

Brief-version: 2
Branch: claude/ticket-buyer-short-code-db
Lane: careful, Opus. HOLD until PR #1276 (my_tickets_v1 event_id, also CREATE OR REPLACEs my_tickets_v1) is merged and applied; copy the live body after that. Admin repo (bachata-admin), migration plus the ticket email text. Must not touch tickets.short_code itself, the door RPCs, checkout, the webhook or anything under the Website repo.
Serves: ticket buyers, who today cannot read out the 6-character door code when their phone or QR fails at the door.

## What main lacks
- my_tickets_v1() rows return qr_token but no short_code, so My tickets cannot show the code -- grep: buyer_short_code_my_tickets
- my_ticket_order_qr_v1(p_order_id) returns {ticket_id, ticket_type_name, qr_token, checked_in} with no short_code, so the thank-you page cannot show it -- grep: buyer_short_code_order_qr
- the ticket email prints the 64-character qr_token and attaches the QR PNG but never the short code -- grep: ticketEmailShortCode
- extends: tickets.short_code already exists (6 characters, NOT NULL, unique) and is only read by the organiser door RPCs; reuse it, do not recreate it -- supabase/migrations/20270314140000_ticket_door_short_code_v1.sql

## Files
- supabase/migrations/20270314190000_my_ticket_order_qr_v1.sql
- supabase/migrations/<next free stamp after the newest on main>_ticket_buyer_short_code_v1.sql (new)
- supabase/functions/_shared/ticketingHandlers.ts
- tests/ticketEmailQr.test.ts
- tests/ticketBuyerShortCodeDb.test.ts (new)
- docs/handover/ticket-buyer-short-code.md (new)

## What to build
1. One migration with CREATE OR REPLACE for both functions (same signatures, same ACLs, same auth gates, same 2-hour window on the order read; copy the live bodies from prod first, read-only). my_tickets_v1 rows gain "short_code"; my_ticket_order_qr_v1 tickets gain "short_code". Every other key is unchanged and still always present. Nothing else widens: no new caller, no new filter, no buyer email.
2. The ticket email (text and HTML) prints, per ticket, "Door code: K7M 2QX" (the code in two groups of three, with a plain line saying to read it out if the QR will not scan). The code is selected in the same query as qr_token. A ticket whose short_code is null still sends the email (no code line, an error log without the token).
3. Undo SQL in the PR body and the migration header: the previous bodies of both functions, signature-exact. Handover note records that the Website brief claude/ticket-buyer-short-code-web is held until this migration is applied.
4. Update the ACL and shape assertions that name these two functions so they expect the new key and the unchanged grants.

## Tests
Table-driven, red first against the unmodified functions: owner or not x paid, refunded, void x inside or outside 2 hours x signed out or guest x one or many tickets. Each row asserts short_code matches ^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$ for the owner and that refusals still return the same empty shape. Email test: with, and without, a short code.

## Done when
Replay proof green, shape survey on prod (counts only: tickets with short_code null must be 0), every CI job step run, independent review passed before the orchestrator applies. PR body carries a Verified / Not verified block.
