# Handover: ticket picker B1 (PR 1 of 2) [dt_71b36b0a75dc]

Flag: `ticketPickerB1` (`VITE_ENABLE_TICKET_PICKER_B1=true`), default OFF; needs `publicTicketing`. OFF = classic Tickets page unchanged.

## Done
- `src/modules/tickets/TicketPickerB1.tsx`: white B1 picker (rows with price top-right and stepper, per-class line, promo box, bar total + Continue + Stripe trust line), email card, 6-digit code card (auto-check on 6th digit, wrong = red + shake + buzz, expired = send new code, Resend + Change email), "Opening secure payment", then Stripe. Signed-in = no code step. Date only in header. Cancel return (`?tickets=cancelled`) keeps basket (sessionStorage) and shows "Payment cancelled. You weren't charged."
- `pickerModel.ts`: pure basket/totals/body helpers. Wire = existing `ticket-checkout` basket body (`lines[]` + `expected_unit_price_pence` + `expected_total_pence`), existing `postTicketCheckout`, existing auth OTP (`signInWithOtp shouldCreateUser:true` + `verifyOtp type:'email'`). No migrations, no new DB objects.
- `EventTicketsPage.tsx`: wrapper picks B1 or classic by flag.
- Tests: `__tests__/ticketPickerB1.test.tsx` (8). Screenshots: `docs/briefs/ticket-picker-b1-shots/` (390x844, harness with canned types).

## Left / next steps
- Promo is a STUB: every code is refused ("Promo codes are not available yet."). Applied-stub UI not built (no backend).
- Confirm the `ticket-checkout` edge function accepts several `lines[]` in one body (the type allows it; only 1-line bodies were sent before) and that Supabase email OTP template sends a 6-digit code (not a link) with `shouldCreateUser:true`. Not testable here (read-only).
- Success page (My tickets + "Finish your profile" card) is the existing thanks page; not changed.
- Free tickets, rate limit, onboarding: out of scope.
- Fee: uses `BOOKING_FEE_PENCE` per ticket like the classic page (currently 0).

## Checks
- tsc (`tsc -p tsconfig.app.json`) run: 0 errors in branch files (repo has ~209 existing error lines elsewhere).
- `npm run lint`: 35 of 36 links green; `check:no-social-word` fails on main too (`priceSteps.matrix.test.tsx:32`, not touched here).
- `npm run pre-ship` timed out at 10 min in the sandbox: NOT run to completion.
