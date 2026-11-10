# HANDOVER 5: event-tickets-page (continuation 4)
DONE: walk green at 390x844 for 3 shapes (several types, one type, sold out quiet bar) against a LOCAL mock Supabase
(tests/e2e/helpers/mockSupabaseServer.ts, run with tsx; dev server pointed at it). Taps >= 44px inside the tickets page,
no sideways scroll. Screenshots: docs/briefs/event-tickets-page/walk/*.png. Run steps: header of tests/e2e/walk-event-tickets-page.spec.ts.
REAL BUG FOUND AND FIXED: BentoPage never passed `programHooks` to EventTicketsPage (HANDOVER-4 said it did), so tapping Buy tickets
crashed to "Something went wrong". Fixed in BentoPage.tsx (one line).
FINDING: the quiet green bar sits inside the tickets page, which opens only from the Buy tickets bar; that bar is hidden when nothing is
buyable. So a cold load of an all-sold-out night never shows the quiet bar; it appears only if tickets sell out while the page is open.
Owner decision needed (show a sold-out bar on the event page, or accept).
Not verified: programme section (mock serves no programme rows), venue chips (need admin fields), find-by-email (NOT built),
live Stripe round trip, unit suite / other CI steps, real-data shape survey.
Spec is NOT in any CI gate list (needs the mock + flag).
