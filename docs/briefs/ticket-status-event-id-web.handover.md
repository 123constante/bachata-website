# Handover: ticket-status-event-id-web

Done: `eventId` on `OrderStatusReading` (paid/failed only); "Back to the event" link on the thanks page (paid/failed/processing); table-driven tests in `orderStatus.eventLink.test.tsx`; one existing `toEqual` in `orderStatus.test.tsx` gained `eventId: null`.
Left: nothing in scope. Note: `pending` replies carry no event_id, so `processing` shows the link only if a reading has one.
