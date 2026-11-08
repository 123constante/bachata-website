# BRIEF: event-page Tickets page (buyer side) -- branch claude/event-tickets-page, Normal lane, Sonnet/Opus per router (new save-free UI, no money logic change: Sonnet builds, Opus reviews if >150 lines of logic)

## Four lines (owner said yes to brief+build in the Phase 0 batch, 2026-11-08)
1. For: people buying a ticket on the event page; organisers selling them.
2. They can: tap the bar, pick a ticket on ONE page (no wizard, no bottom sheet), pay, get the QR at once, find it again.
3. Worked if: a real buy and a real door scan complete on the walk-test event.
4. Out of scope: reminder email, volunteer door link, pay-now QR, replacing the guest list, any DB change, any change to checkout/payment logic.

## Design source of truth
`docs/briefs/event-tickets-page/mockups-7.html.md (the HTML is inside the code fence; save it as .html to open it)` (round seven: round five + Good-to-know chips, independently critiqued). Decisions: amber (#FF9900) bottom bar with dark button; quiet dark-green bar for non-actionable states; 64px gradient symbol tiles picked from ticket name (whole-word match; price 0 = free); quantity pill up to 20; one QR per ticket; programme block from the event's own programme (max four items, then "See full programme"); door screens; My tickets + find by email. Full weekday and month names. Chips are information only (rounded rectangles, not tappable).
Decisions file: plans decisions 2026-11-07 (the "bottom sheet" line is superseded by path A, one page).

## Good to know chips (show only known values, never "No bar"; order fixed)
Event length; Bring photo ID (venue id_required true only); Bar; Cloakroom; "[Type] floor"; Music styles (max 3 then "+N"); "Tickets until <Weekday D Month, time>" (latest ticket close, else event start); Parking. Sources: see section 2b of the mockup. Bar/cloakroom/ID/parking/floor are a READ addition from the venue (no DB change). Block hidden if no chips.

## Before drawing code: INVENTORY (rule 1)
Re-inventory against current main (plans/INVENTORY-event-tickets-ui.md is from before #1493, #1491, #1496, #1500 merged). Write docs/briefs/event-tickets-page/INVENTORY.md with file:line for: sticky bar, TicketsBlock and its states, thanks page, My tickets, door refused card (#1439), venue fields read. Coverage count at the end.

## Acceptance contract (person x journey x data shape)
Persons: stranger (signed out), signed-in dancer, returning buyer with a ticket, organiser viewing own event.
Journeys: see tickets from the bar; pick type and quantity; pay paid; reserve free; promo; sold out type with others buyable; sales not open / closed; paused; cancelled return; failed/pending pay; thank-you QR; My tickets upcoming/past/empty/error/signed-out; find by email.
Shapes: 1 type / several; free / paid / mixed; with / without programme; chips all / some / one / none; series / per-night; long names and long parking note (wrap, no clipping); 20 max.
One table-driven vitest per screen x shape using one shared mapping (e.g. chips builder, symbol picker); red first for any bug fix.

## Limits and checks
- Tap targets >= 44px visual, use h-[48px] not h-12 (13.5px root on phones). Explicit px sizes.
- Flag publicTicketing guards everything; no change when off.
- Run every CI job step; PR body via pr-body.mjs with Shapes surveyed + Phone QA 390x844 + Verified / Not verified.
- Walk 390x844 on laptop walker (laptop-walk.mjs --branch). Screenshots in the PR.
- HTML entities for punctuation in JSX; files over 2 KB via scripts/safe-edit.py.
- Prod has one paused test ticket (ebe4ddff): no prod writes; walk with fixtures/mock where needed and say so in Not verified.
