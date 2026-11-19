# Brief: dedicated "Free" row on the ticket picker (Website half, slice A gap)

Lane: normal (no DB change in this PR). Branch: claude/free-row. Flag: everything behind existing `VITE_ENABLE_TICKET_PICKER_B1` (+ `VITE_ENABLE_PUBLIC_TICKETING`); add NO new default-on behaviour.

## Owner rule (2026-11-17, ticket-buyer onboarding)
- Free party ticket is its OWN row on the picker, price shown as "Free", max 20 per order (whole order, shared with class tickets), mixable with class tickets with no warning, ONE checkout for mixed orders, page summary shows everything.
- Not signed in: email, 6-digit code on the same page, confirmed BEFORE Stripe and before any free ticket. Signed in: no code.
- Free-only order skips Stripe. Ticket issued first.
- Every free ticket is the buyer's own (one QR each).
- Design: picked picker design B1 (registry rows "ticket picker"); no chips, no savings line, no best-value tag.

## Facts already found (origin/main 5000129c7)
- A free ticket today is just a ticket type with `pricePence === 0` (`src/modules/tickets/ticketCheckoutModel.ts:186,248`). `TicketPickerB1.tsx:239` handles `kind==='free'`.
- No dedicated Free row, no "Free" price wording per row, no mixed free+paid proof found.
- Cap const: `MAX_PER_ORDER = 20` (`ticketCheckoutModel.ts:9`); `pickerModel.ts` clamps the basket.

## Do
1. Render a `pricePence === 0` type as its own row labelled with price "Free" in the picker (`TicketPickerB1.tsx`, `pickerModel.ts`). Reuse existing row component and tokens; no new visual language.
2. Mixed basket (free + paid): prove the checkout path. Read the create-checkout caller and the edge function contract in the admin repo (read only, `c:\dev\bachata-admin-11april`). If mixed orders are NOT supported server-side, do not fake it: report what is missing in the PR body and make the picker block mixing behind a clear note ONLY if the server cannot do it. Say which.
3. Summary line on the page lists free and paid lines; free-only order shows no payment step and no "Total paid GBP 0.00".
4. Unit tests for the model (basket clamp across free+paid, summary, label). Update the existing matrix test, do not pin counts in prose.

## Out of scope
Organiser "Free party entry" switch, per-email rate limit, unlimited capacity (admin repo, separate careful-lane brief). Finish-profile card. Renames.

## Checks
`npm run test:unit`, `npm run lint`, `npm run pre-ship`. 390x844 walk on prod-shaped data: a night with one free type and one paid type, plus a night with only a free type. PR block "Verified on real data". Phone html font ~13.5px: explicit px for tap targets. HTML entities in JSX (`&mdash;`).
