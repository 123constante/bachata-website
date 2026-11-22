# Handover: post-pay lands on the Tickets tab (brief postpay-tickets-tab)

Flag: `VITE_ENABLE_POSTPAY_TICKETS_TAB` (default OFF, `src/lib/postpayTicketsTabFlag.ts`). Rollback = flag off.
Needs `VITE_ENABLE_BUYER_ONBOARDING=true` and ticketing on to be visible.

Done (flag ON): thanks page -> `/app/tickets?o=`; "You're booked" bar (processing variant: spinner + wait line);
card shows event + date; AccountLinkPanel moved Tickets -> Me. Flag OFF = unchanged.
Tests: `postpayTicketsTab.matrix.test.tsx`.

Left / not done: processing bar has no event name (the pending view carries none); no 390x844 browser walk;
no real-data survey; `pre-ship` not run; no door-code changes (per brief).
