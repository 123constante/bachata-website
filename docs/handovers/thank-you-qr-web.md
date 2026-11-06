# Handover: thank-you-qr-web

Branch `claude/thank-you-qr-web`. Paid thank-you page now shows the buyer's door QR (signed in + paid + order id), via lazy `OrderQrBlock` calling `my_ticket_order_qr_v1`.

## Done
- `TicketQrCode.tsx` (shared QR, moved out of MyTicketsPage; only importer of `./qr`), `OrderQrBlock.tsx`, `fetchOrderQr`, `parseOrderQr`.
- Thank-you page: block sits between order reference and "See your tickets"; lazy via `lazyWithRetry`. Existing copy, polling and links untouched.
- Tests: new `orderQr.test.tsx` (red on main: import of OrderQrBlock failed, whole file); `flagOff.test.ts` extended (qr importer = TicketQrCode only; thanks page imports OrderQrBlock lazily only).

## Verified
- `npx vitest run src/modules/tickets`: 11 files, 455 tests green (MyTickets tests unmodified).
- `npm run typecheck`: no errors in `src/modules/tickets`; 109 repo-wide errors, all in untouched files (pre-ship baseline says 106; not diffed against main).
- `npm run lint`: 24 of 24 links green (eslint informational). `check:mojibake` clean. `npm run build` ok; `check:bundle-budget` all respected (generator stays out of first-load chunks).

## Not verified
- A real just-paid order: no order was paid in the last 2 hours on prod, so the live answer is `[]`. Prod was not queried by this worker. Owner/orchestrator walks a just-paid order in the ticket preview walk.
- Phone QA (390x844, 320x568; 1, 3, 9 tickets): not walked.
- Other `pre-ship` / architecture guards beyond the lint chain not run separately; the 3-error typecheck gap vs baseline not diffed against main.
