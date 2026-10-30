# S7 "Copy my last event" (Organiser front door, Release 4)

PARKED: festival copy needs admin PR #1004 (`organiser_save_festival_v1`) applied. Do not merge before.

## Brief
A "Copy as a new event" button on the organiser's events list and on an event's page. It opens the
normal New event flow pre-filled from that event. The date is blank ("Pick the new date"). The copy
is always a draft. Past dates, status and other people's data are never copied.

## Choice: client-side pre-fill, not the server copy
Admin PR #1009 (`organiser whole-event copy`, migrations `20261229060000-070000`) is not applied on
prod, so nothing here may call it, and a typed client against a function that does not exist cannot be
tested for real. The pre-fill reuses the save path that already works: the normal New event create
(`series.create_draft`), then ONE `series.upsert` of the copied fields. Nothing saves until the person
takes the normal steps, and the create/save error mapping (`commandErrorMessage`) is the existing one.
When #1009 lands, the swap is one function (`prefillCommands` -> the server call).

## What is copied (allow-list in `flows/copy/copyModel.ts`)
Name, description, venue and city, start time, duration, ticket link, cover image, programme text
(none held on the series row today, so empty).
Never: any date, status (always draft), RSVPs, going counts, admin notes, unpublish history.

## Festival edition (pure + tested, UI waits for #1004)
`copyEdition` shifts every day by (picked start - first source day) in whole London-date days, so gaps,
month ends and the 25 Oct 2026 / 28 Mar 2027 clock changes are ordinary days. Days before today are
dropped; the result never exceeds 10 days (`copyView` refuses an 11-day source with a reason rather
than cutting days silently). Ticket link and cover are kept only on Keep (Keep / Clear). Line-ups are
not in the copy source, so they are never copied. There is no festival form in the organiser app yet
(New event offers weekly night and one night only), so there is no festival button on screen.

## Layout (390x844)
Event page: a full-width 52px ghost button under the actions. Events list: a 44px button under each
row (the row itself is still one link). A disabled button says why in 14px text beside it. After the
tap the New flow opens at the name (pre-filled), then goes straight to "Pick the new date".

## States
No events: "You have no events to copy yet. Add your first event." Not found, nothing copyable,
too many days, network error and opening are all in `COPY_TEXT`, one mapping (`copyView`) for every
button. Double tap: a ref guard, so the second tap opens nothing.

## Checks
310 table tests: {past, future, today, none, 1/3/10/11 days} x {draft, live, archived} x {ticket and
cover kept/cleared} x {RSVPs, none} x {organiser, admin} x {event, festival} + offsets + double tap.
