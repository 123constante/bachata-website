# my-tickets-entry-points (Website, BUILD-visual, small)

Brief-version: 2
Lane: Website. Model: Sonnet, medium. Queue: B. Branch: `claude/my-tickets-entry-points`.
Serves: queue Q3. **Dispatch only after `my-tickets-screen` is merged** (it adds the route `/account/my-tickets`). Not a parallel job with it.

## What main lacks
- A way to reach My tickets: the thank-you page shows "Your tickets" as a breadcrumb label only (`src/lib/breadcrumbs/siteIa.ts:81`) and no link; the signed-in dancer home has no tickets row. -- `src/modules/tickets/TicketThanksPage.tsx`, `src/components/account/DancerHome.tsx`
- Copy that points at a control that exists: on the paid thank-you state add "See your tickets" (when signed in; when signed out the existing sign-in copy stays). The failed state keeps its homepage link (the event id is not returned by `ticket_order_public_status_v1`: an admin change, queue Q7, BLOCKED, do not work around it). -- `src/modules/tickets/ticketCheckoutModel.ts` (`thanksCopy`)

## Files
- `TicketThanksPage.tsx`, `ticketCheckoutModel.ts`, `DancerHome.tsx` (one row, shown whenever `publicTicketing` is on; no extra read on the dancer home), tests in `src/modules/tickets/__tests__/orderStatus.test.tsx` and a DancerHome test.
- Do NOT touch `src/components/EventCalendar.tsx` or other density-exempt files.

## Rules
No migration. Flag `publicTicketing` OFF on prod: flag-off must change nothing (extend `flagOff.test.ts`). Dancer home is on the app shell's first-load path: keep the added bytes at zero (a `<Link>` and a string only; no new import of the tickets module); check `perf-budgets.json`.

## Tests red first
Table: order state (paid, pending, failed, unknown order) x viewer (signed in, signed out) x flag (on, off). Paid + signed in has the link to `/account/my-tickets`; failed has none; flag off renders exactly today's output (red on main for the paid+signed-in cell).

## Phone QA
390x844 and 320x568; walk paid, pending, failed on the thank-you page and the dancer home row. Tap target 44px. Shapes: dancer with and without a dancer profile, organiser-only account.

## Done
Handover; PR per checkers; Not verified: a real purchase redirect from Stripe.
