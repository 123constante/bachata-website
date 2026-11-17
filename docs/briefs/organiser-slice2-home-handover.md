# Handover: organiser slice 2, Home dashboard

Ticket `dt_ea236978b66a`. Branch `claude/organiser-slice2-home`. Brief `docs/briefs/organiser-slice2-home.md` on `brief/organiser-slice2-home`.

## Done
- `p3/dash/dashModel.ts`: `HomeClock` (before / night / after), `PastNight`, `dayAfterOf`, `compareOf`, `tapsOf`, ONE tip in place of zero rows (`TIP_NO_TAPS`, `TIP_DRAFT`). Opens / page views removed from Home (owner decision 5); money never drawn.
- `p3/dash/homeClock.ts`: `homeClockOf` wraps `tickets/a/clockState.ticketsClock` (no second clock). Night = next live night inside its door window; after = tonight's door shut, or the last night was yesterday.
- `p3/dash/pastNights.ts`: reads only, no new RPC. Occurrence ids + raffle result from `organiser_raffle_nights_v1` (lists every night); Who came = `in_count`, tickets sold = `total_count` from `ticket_door_list_v3(series, occurrence)` for that past night. A refused seat gives null, never 0.
- `DashHome.tsx`: taps by type from `organiser_analytics_v2` zones (`group_chat` = WhatsApp) on the series' next night only (single-series page, as opens were; GAP-4). Going via `P3NightGoing` (its own gate). Door link on the night (`flags.organiserTicketing`).
- `DashView.tsx`: day-after block (big Who came, tickets sold + raffle underneath; no count = no big number), taps line, tip, Door button, Compare nights row at the bottom.
- `CompareNights.tsx` + route `/account/p3/compare` (only with `organiserDash`), pushed (`isPushed`), so no bottom tabs.
- Tests: `dash/__tests__/slice2Home.matrix.test.tsx` (clock x zero/some/many x contributor/owner x live/cancelled/draft/13-date series, plus clock, compare, reads).

## Real data (prod, counts only)
467 series; 57 with 13+ dates (max 133); 456 with past nights; 32 with a cancelled night; 13 draft series. **0 tickets tied to a night, 0 check-ins** -> today every day-after shows no big number (and no tickets line); Compare nights shows its empty state.

## Left / next
- Going for PAST nights has no read (get_my_event_going_v1 is upcoming only), so Compare's Going fallback never fires today.
- Multi-series pages show no taps (analytics is summed across series; per-night taps need GAP-4).
- With the V2 shell on (`organiserShellV2`) there is no Home tab (slice 1): this Home shows only with P3 + Dash and V2 off.
- 390x844 browser walk with a signed-in organiser not done in the cloud (no auth): run laptop-walk.
