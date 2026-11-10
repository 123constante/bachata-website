# INVENTORY: pause a recurring series from the website, with a resume date (2026-11-10, website-50)

Read-only sweep by an Explore agent. Admin local checkout is BEHIND origin/main (migrations stop at 20261115*; origin/main has 2027*). Items marked [origin/main] were read with `git show`. Admin paths are relative to C:/dev/bachata-admin-11april; Website paths to C:/dev/wt-welcome.

## Pause today (admin)
- `_cmd_series_set_lifecycle_p5(p_series_id, p_payload, p_actor)`, payload `{to}` only: supabase/migrations/20261108130000_p5_owner_allowlist_series_set_lifecycle_v1.sql:95-185. Paused permission `_assert_can_edit_series_p5` (:131-150). Owner allowlist `_owner_lifecycle_transition_allowed_p5` (:75-93): live>paused, paused>live, paused>archived. Dispatcher `apply_aggregate_write_p5` (:189-326). paused>live runs `_event_publish_blocking_reason_v1` (:152-157).
- Public effect: 20261109830000_paused_series_keeps_page_and_history_v1.sql: page stays (200) only if the series has a past, non-archived date; else 404. Upcoming dates hidden via `_p5_paused_hides_occurrence_v1`. Listings exclude paused via `_p5_series_public_visibility_v1` = live only (20261106020000...:19).
- Admin UI: lib/lifecycleTransitions.ts:43,:78; lib/lifecycleConfirmCopy.ts:17-36,:76-79; lib/eventCommandP5.ts:498.
- NOT FOUND: resume-date column, paused_at, pause reason, auto-resume job.

## Recurrence
- `series.set_recurrence`: lib/eventCommandP5.ts:288. Column `event_series_p5.recurrence_rule` jsonb (20260715120000...:24-26).
- NO repeat rule = format 'one_off' (rule NULL), or format 'recurring' with NULL rule ("occasional", dates are the source). Course requires a rule. 'ended' requires NULL rule.
- In flight: origin/claude/courses-owner-set-recurrence (99990101000000_course_owner_set_recurrence_v1.sql) touches apply_aggregate_write_p5. My migration must sequence after it.
- Website: p3/screens/RepeatSheet.tsx; EventPage.tsx:319.

## Tickets and cancelled nights
- [origin/main] ticket_types / ticket_orders / tickets: 20270302020000_ticketing_p1_schema_v1.sql:47,69,103. Series-scoped; no occurrence_id yet (docs/briefs/ticket-night-aware-s1a.md:7-12). S1a (#1352) adds it; NOT merged. NO per-night sold count exists.
- `ticket_sales_summary_v1(p_organiser_id)` per type: [origin/main] 20270314170000_ticket_promo_codes_v1.sql:793.
- Ticket-type status 'paused' is a different thing: src/modules/organiser/tickets/ticketModel.ts:13.
- Cancel a night: `_cmd_occurrence_cancel_p5`: 20261109880000_cancel_reason_soft_rule_v1.sql:259-330. Website: p3/screens/CancelEventSheet.tsx.
- Paused page disables tickets/RSVP; nothing cancels or refunds existing orders.

## Scheduler and notices
- pg_cron + net.http_post + edge function with a cron auth header (name in the migration): 20261109660000_organiser_edit_digest_v1.sql:12-26,:203-227. SQL-only daily cron: 20260718090000_series_horizon_nightly_topup_v1.sql:89 (covers live and paused).
- [origin/main] organiser to-do + deadline notice outbox: 20270321010000_organiser_todo_state_v1.sql; supabase/functions/todo-deadline-email. Move-date notices: 20270314180000.
- Existing digest emails the owner address only. NOT FOUND: in-app notification inbox.

## Website
- Organiser event screen has NO top menu: a status row opens StatusSheet. src/modules/organiser/p3/screens/EventPage.tsx:312-317,:341; StatusSheet.tsx; data/eventPage.ts:255-296 (Website label is "Hide"/"Show"; one-tap hide = lifecycleCommand('paused') with undo, no date).
- Older flow with Pause/Resume: flows/event/EventStep.tsx:18-27,:153.
- Public: src/modules/event-page/bento/EventPausedBanner.tsx ("On hiatus, no upcoming dates"; no date); BentoPage.tsx:47,:409-411,:700-709,:739-743; lifecycleBanner.ts; buildEventPageModel.ts. Paused: no Event JSON-LD.

## Gaps (what the feature must add)
1. Store a resume date; extend `_cmd_series_set_lifecycle_p5` payload; clear on any non-paused target.
2. Daily auto-resume job (London date); must pass or deliberately bypass `_event_publish_blocking_reason_v1`.
3. Snapshot must expose the date; public banner copy "Back on D" / "On a break".
4. Sold-ticket block: series-level paid-order count only until S1a. Organiser-readable count needed.
5. Website "Hide" is one tap and means paused; becomes a confirm step with the two choices. Wording clash: "Hide" vs "Pause series" (owner chose "Pause series").
6. Reminder, confirm and nudge delivery: needs per-organiser channel (to-do outbox on origin/main is nearest).
7. Rule-less series (11 live): pause works the same (lifecycle only).
8. Admin checkout must be updated from origin/main before any migration is authored.
