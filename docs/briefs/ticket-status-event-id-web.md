# Brief: T8 Website half -- thank-you page links back to the event

Repo: 123constante/bachata-website. Branch: claude/ticket-status-event-id-web (from current main). Lane: normal. Model: Sonnet. One push (Vercel cap).

Why: admin #1233 is MERGED and applied by the queue: `ticket_order_public_status_v1(p_ref)` now returns `event_id` (the public id `/event/:id` accepts; NULL unless the series is live or paused, and NULL on `unknown` and `retry_later` replies). The failed copy in `thanksCopy` says "You can go back and try again", but the page only offers a link to `/`. Give it the real way back.

Do:
1. src/modules/tickets/ticketCheckoutModel.ts: add `eventId: string | null` to `OrderStatusReading` (default null in the empty reading ~line 309; parse in the reader ~line 323 with the same `str()` helper, only for status paid or failed like eventTitle; any non-string or empty = null).
2. src/modules/tickets/TicketThanksPage.tsx: when `reading?.eventId` is set and state is `paid`, `failed` or `processing`, show a 44px-tall link to `/event/${eventId}` labelled "Back to the event" (failed: "Back to the event to try again"), above the existing "Back to what's on" link, which stays. No eventId: page is exactly as today. Use explicit px sizes (the site's rem trap), HTML entities for punctuation, no raw Unicode punctuation.
3. Tests: table-driven in src/modules/tickets/__tests__/orderStatus.test.tsx (or a new sibling file) over status (paid, failed, pending, unknown, retry_later) x eventId (set, null, empty string, number) x free: assert the link is present only for the intended rows, points at /event/<id>, copy never mentions a control that is absent. RED FIRST: run the new rows against unfixed code and say which failed. Run the existing orderStatus tests unchanged.
4. Also run the full ticketing test folder, lint chain for touched files, and typecheck. Read .github/workflows and run every CI job step that applies; put the per-job table in the PR body.

Not in scope: copy changes beyond the new link, any other page, any DB or admin change, flags. Do NOT touch the calendar density-exempt files.

PR body: run the steps of ~/.claude/bin/pr-body.mjs equivalents by hand if unavailable: sections "Verified on real data" (label exactly `- Shapes surveyed:`) and "Phone QA" with a size like 390x844. Shape survey = read-only counts from prod via the Supabase connector: ticket_orders by status, and how many series are live/paused with and without legacy_event_id (counts only, no personal data).
Early checkpoint push after the first green test run. Push and write a short handover before stopping.
