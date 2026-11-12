# Brief: organiser Raffle inside each night, Option B (Raffle row -> sheet with 4-step track)
Owner pick 2026-11-12: Option B. Design: docs/design/profile-dash/organiser-raffle.md + organiser-raffle-option-b.html (merged, PR #1586). Follows Raffle v2 (#1405, #1414): do not redesign it. Non-money (no prices/payouts) but opening/closing a raffle is a HARD STOP for automation: no agent or bulk path may call the write RPC.
## Acceptance contract (person x journey x data shape)
- Organiser owner x open the raffle for one night, with confirmation both ways x no entries, 23 entered (locked), 41 closed, drawn, nobody entered past, cancelled, draft.
- Organiser x see winner name + draw time + entries count on a drawn night x 16 prod wins have occurrence_id NULL today (G5).
- Contributor x view only with reason ("ask an owner").
- Any role x 50+ night list (max 53 in one series, 135 entries on one night) scannable by chip.
## Phases
1. Admin (careful): organiser_raffle_nights_v1 read (membership-gated); server lock "once anyone has entered"; per-night entries count + snapshot on the draw; organiser_raffle_night_set_v1 write (owner/manager, refuses locked/past/cancelled/draft, writes raffle_nights.set_by); draw sets raffle_wins.occurrence_id; decisions: winner name shown (first vs full), "Message us to cancel" destination, series default vs per-night (53 series on, 0 nights overridden).
2. Website read: Raffle row + sheet with the 4-step track (Open, Entries, Closed, Winner), all shapes.
3. Website write: one button that says what it does; confirmation sheets; failed state ("Nothing changed") + Try again.
## Checks
Table-driven screen x shape; 390x844 walk; CI table in PR; Verified/Not verified; independent review (ACL, hard-stop, privacy) on phases 1 and 3.
