# Brief: fold /tickets/thanks into the Tickets tab (behind OFF publicTicketing)

Goal: after Stripe returns (or a free order completes) the buyer lands on `/tickets/thanks`
(`src/modules/tickets/TicketThanksPage.tsx`, route in `src/components/AnimatedRoutes.tsx`,
`THANKS_PATH` in `src/modules/tickets/ticketCheckoutModel.ts`). The Tickets tab now exists at
`/app/tickets` (website #1664, merged). Make the thanks return land the buyer in the Tickets tab
with their new order visible, keeping `/tickets/thanks` as a working entry that forwards.

Smallest build:
- `/tickets/thanks` keeps reading the Stripe session/order id (see `orderStorage.ts`), then
  navigates (replace) to `/app/tickets` carrying what the tab needs to show the just-paid order.
- Signed-out or incomplete-profile buyers: keep today's thanks page as the fallback (do not break it).
- All behind `flags.publicTicketing` (OFF); do not touch the flag, calendar density files,
  `src/components/ui/dialog.tsx`, or any migration/SQL.

Known trap: the first attempt (a plain redirect in #1664) broke a walk spec and was dropped.
Run `npm run test:unit`, the relevant walk/e2e spec(s) and `npm run pre-ship`; fix in this PR.
Walk at 390x844 (explicit px tap targets). PR body: what it does, checks at head, Verified / Not verified.
