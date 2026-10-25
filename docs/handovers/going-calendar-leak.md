# Handover: going-calendar-leak (Going P0.5)

## Done
- `CalendarListView`: "{n} going" pill gated on `GOING_CHECKIN_ENABLED`.
- `EventCalendar`: `get_event_attendance_counts_by_range` query `enabled: GOING_CHECKIN_ENABLED`
  (so `attendanceCounts` stays undefined and no goingCount is mapped while off).
- `src/components/calendar/__tests__/goingCountSwitch.test.tsx`: list view and EventCalendar, switch off and on.
  RED on unfixed code: both "off" cases failed (text "going" present; RPC called once). Both "on" cases passed before and after.

## Other going/attendee-count surfaces in src/ (grep)
- `modules/event-page/sections/EventAttendanceSection.tsx` renders goingCount, ungated -- no importer (dead code), left.
- `modules/event-page/buildEventPageModel.ts` builds `goingCountLabel`; only consumed by RsvpBlock/Placeholder, both gated. OK.
- `BentoPage.tsx`, `RsvpBlock*`, `NightsScreen`, `HomeScreen`: already gated.
- `PublicDancerPageV2.tsx` "See all N events": a dancer's own going list, not an event count; not changed.
- `MoreEventsSection.tsx`: no going count (comment only).
- CalendarGrid / DayDetailModal: no going count.

## Not verified
- No prod shape survey / browser walk (CI-less cloud worker, no browser walk run).
- `npm run lint`: 19/20 links pass; `check:integrity` exit 126 (sandbox exec permission, unrelated); eslint backlog unchanged (same 5 problems before and after on touched files).
