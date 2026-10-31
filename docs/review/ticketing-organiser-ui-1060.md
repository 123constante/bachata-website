# Design critique: PR #1060, S3b organiser ticketing (Option B, Compact)

Branch `claude/ticketing-organiser-ui` at `939903a`, judged against
`briefs/ticketing-organiser-redesign.md`, mockup B and `design-density.md`.

**Verdict: the build matches mockup B.** All six screens carry the briefed copy, one Next step
on first open, Back keeps values, sticky bars clear the safe area, taps >= 44px, no sideways
scroll, full month and weekday names, contributor read-only, `returnFocusRef` on both sheets,
no raw Unicode in source. Four material fixes, one blocking.

## How it was checked
- Ran the app in my sandbox (dev server, the phone suite's fake Supabase, rows shaped like the
  live RPCs: 2,022 sold, &pound;240,170 gross, a 62-character title, a 50-character buyer name, a
  null buyer, draft / paused / sold-out / closed types, pending Stripe, contributor).
- Walked 20 states at 390x844 in Playwright: every briefed screen plus not-switched-on, pending,
  switch and upsert refusals, Back through the steps, locked price, Close-sales confirm,
  long-title sold-out event, bare event via `?add=1`, contributor Home / event / edit.
- Measured every control (none under 44x44), page and sheet `scrollWidth` (never wider), action
  bar and sheet footer bottoms (= 844), focus return after both sheets.
- Contrast from `ember.css` tokens: lowest pair 4.59 (`--ph` on `--card2`); `--mut` on `--card`
  5.84, `--btnfg` on `--danger` 7.52. Unit: 1,097 ticket + focusReturn tests pass.

## Material fixes (ordered)

1. **BLOCKING. The "Paid out via Stripe" chip removes the profile switcher.**
   `src/modules/organiser/tickets/TicketsHome.tsx:128` passes the chip as `topBarEnd`, and
   `src/modules/organiser/shell/OrganiserShell.tsx:103` renders `topBarEnd ?? <OrganiserSwitcher />`.
   Before payments connect the top-right avatar (Switch profile) is there; once connected it is
   gone on this one screen (my walk and the author's `02-home-connected.png`). Fix: drop
   `topBarEnd`; put the chip on the page-name line at `TicketsHome.tsx:124` (name left, tag right).

2. **Should-fix. Event card "left of" counts places nobody can buy.**
   `src/modules/organiser/tickets/ticketModel.ts:472-478` (`eventLeftLine`) sums every non-closed
   type, so Friday Social read "Selling &middot; 158 left of 170" when only Early bird (8 of 20)
   was on sale and the other 150 were a paused and a draft ticket. The brief's "8 left of 20"
   means places on sale. Fix: filter to `on_sale` and `sold_out` (fall back to the chip alone
   when none), and add that mixed shape to `compact.model.test.ts` "event state and places left".

3. **Should-fix. Money and counts have no thousands separators.**
   `ticketModel.ts:156` (`formatPence`) gives "&pound;240170.00" on the Sales card
   (`parts.tsx:206`) and "&pound;1235.06" in Buyer pays; Sold shows "2022" (`parts.tsx:202`).
   Fix in the one helper: `(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2,
   maximumFractionDigits: 2 })`, and the same for the Sold count; the matrix expectations come
   from the helper so they follow.

4. **Should-fix. No way to connect or finish Stripe once the Next step card is gone.**
   `ticketModel.ts:486-493` marks payments done when every ticket is free, `ticketModel.ts:505-521`
   then never returns `connect`, and the only Connect / Finish connecting button lives in
   `parts.tsx:113`. An organiser with a half-finished Stripe account and free tickets (the card
   itself invites "Selling free tickets? Add one now") has no "Finish connecting" anywhere, and
   Home shows no "Not connected" state at all. Fix: when `stripe !== 'connected'` and the Next
   step is not `connect`, render one `LINK` under the number cards ("Payments not connected.
   Connect" / "Finish connecting") reusing `startOnboarding` (lift `go()` from `NextStepCard`
   into a small hook).

Smaller: an edit always opens at step 1 (`TypeSheet.tsx:62`), so raising places is four taps;
consider `Save changes` on every step of an edit. `parts.tsx:289` names an `aria-describedby`
id that is not rendered when the reason is the role one (`SeriesTickets.tsx:270`).

## What the tests do NOT cover
- Anything geometric: tap size, overflow, safe-area padding, sticky bars (jsdom).
- The top-bar swap in fix 1.
- "Close sales for good" confirm (`tix-close-confirm` appears in no test).
- The back-from-Stripe notes (`tix-getpaid-back`, `?stripe=return|refresh`) and the orders
  empty-state words (`tix-orders-empty`).
- The mixed draft / paused / on-sale "left of" shape (fix 2).
- Real Stripe onboarding and refunds (edge contracts assumed), a real contributor row
  (`organiser_home_v1` never returns one), orders beyond one 100-row page, iOS focus return.

Verified (this review): the walk, measurements, contrast and unit run above. Not verified:
360x640, real devices (safe-area insets exist only on hardware), real RPC data.
