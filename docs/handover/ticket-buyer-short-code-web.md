# Handover: buyer short door code on My tickets + thank-you page (dt_f0e9e4436cc6)

Branch `claude/ticket-buyer-short-code-web`. Brief `docs/briefs/ticket-buyer-short-code-web.md` on
`brief/ticket-buyer-short-code-web`. Design record `docs/design/ticket-buyer-short-code.md`.
Inventory `docs/design/ticket-buyer-short-code/INVENTORY.md` (23 / 25 covered, 2 N/A).
Walk pictures (390x844, door flag ON locally): `docs/walk/ticket-buyer-short-code/*.png`; spec as
`walk.spec.ts.txt` (deliberately not in the e2e gate: needs both ticket flags at dev-server start).

## HOLD check
The DB change is live on prod: `my_tickets_v1` and `my_ticket_order_qr_v1` both return `short_code`,
and `tickets.short_code` exists (read-only SELECT, 2026-11-06).

## Done
- `parseShortCode` / `formatShortCode` / `doorCodeText` / `DOOR_CODE_LABEL` in `myTicketsModel.ts`;
  both parsers carry `shortCode` (bad / missing = null; the row is never dropped).
- `DoorCodeLine.tsx`: one shared line for both screens (mono 18px, muted + "Checked in" when used,
  spelled out for screen readers).
- My tickets: the line sits directly under the QR, or in the QR's place when it is collapsed,
  behind "Show anyway" or unavailable. Thank-you: under the QR box.
- Gated on the door flag `ticketDoorCode` (OFF in prod), so **prod buyers see no change until
  `VITE_ENABLE_TICKET_DOOR_CODE=true`**. That is deliberate: the buyer code and the door box
  switch on together.
- Tests: 48-case matrix per screen (8 reply shapes x 3 ticket states) + flag-off + parser cases.
  Red first: 24 failures on the unfixed code.

## Left / next steps
- Owner: when ready, set `VITE_ENABLE_TICKET_DOOR_CODE=true` in Vercel (door + buyer together),
  then phone-test My tickets on a real order.
- `test:e2e:p3` was not run to completion here (sandbox timeout); `doc-weight` and lighthouse need
  a preview and CI runs them.
- Code review round 2 (user-facing) was not run; round 1 findings are triaged in the PR body.

## Status at hand-off
- PR: #1457 (not merged, not approved by the worker; not automerge: UI paths changed).
- tsc run on 81e4db8: 0 errors in branch files (119 repo-wide, none in this diff).
- PR body label lines checked locally: check-pr-real-data-verified OK, check-pr-phone-qa OK.
