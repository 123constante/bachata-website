# Handover: ticket-status-event-id-web

Done: `eventId` on `OrderStatusReading` (paid/failed only); "Back to the event" link on the thanks page (paid/failed/processing); table-driven tests in `orderStatus.eventLink.test.tsx`; one existing `toEqual` in `orderStatus.test.tsx` gained `eventId: null`.
Left: nothing in scope. Note: `pending` replies carry no event_id, so `processing` shows the link only if a reading has one.

## Continuation handover (dt_38c6ccfe7948)
- Merged origin/main into the branch (merge commit; clone was shallow, unshallowed first).
- TicketThanksPage.tsx conflict resolved: QR block, "See your tickets", "Back to the event", "Back to what's on" last. orderStatus.test.tsx auto-merged with main's block + `eventId: null`.
- Added processing (gave up polling) rows, eventId set and null, to orderStatus.eventLink.test.tsx. Finding: parseOrderStatus nulls event_id for pending, so the processing link never renders in practice; the rows assert absence. The `processing` clause in the page condition is currently unreachable.
- Checks: vitest src/modules/tickets 603 pass (14 files); tsc --noEmit clean; check:mojibake clean; eslint clean on touched files (a pre-existing set-state-in-effect error exists in a different tickets file).
- Not verified: other CI jobs, browser phone walk. PR body Checks line must be updated via the GitHub MCP.
