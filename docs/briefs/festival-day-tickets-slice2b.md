# Festival day tickets slice 2b: Website DoorScreen on the v3 door functions

Repo: Website. Branch: claude/festival-day-tickets-slice2b. Lane: careful (door scanning, prod RPC contract). Owner design: NONE changes; this is a contract swap, the screen looks the same except the new refusal wording below.

## Goal
Switch the organiser door screen (src/modules/organiser/p3/door/) from the v1 door RPCs to the v3 ones that are LIVE on prod (admin migration 20270323020000_festival_day_tickets_s2a_v1, applied 2026-11-17). Do not revoke anything (that is slice 2c, admin repo).

## Mapping (read the migration at admin repo supabase/migrations/20270323020000_festival_day_tickets_s2a_v1.sql for exact bodies)
- ticket_check_in_v1(p_qr_token, p_event_series_id) -> ticket_check_in_v3(p_qr_token, p_event_series_id, p_occurrence_id)
- ticket_check_in_by_code_v1(p_code, p_event_series_id) -> ticket_check_in_by_code_v3(p_code, p_event_series_id, p_occurrence_id)
- ticket_check_in_by_id_v1(p_ticket_id, p_event_series_id) -> ticket_check_in_by_id_v3(p_ticket_id, p_event_series_id, p_occurrence_id)
- ticket_door_list_v1(p_event_series_id) -> ticket_door_list_v3(p_event_series_id, p_occurrence_id)
- door_scan_v1(p_payload) -> door_scan_v2(p_payload) if the Website calls it (grep; admin-app callers are out of scope).
- p_occurrence_id is nullable: pass null when the screen has no chosen night (server picks the door day). Keep the screen's existing night concept; do not add a night picker.
- Regenerate/patch src/integrations/supabase/types.ts for the v3 signatures only (do not hand-edit unrelated entries).

## Reply shape
Read the v3 bodies for every `result` value. New/changed results to handle in model.ts and DoorScreen: wrong_night, wrong_day, add_on_not_admission, unclassified_festival_type (new refusals), and festival PASS "already_used" per door day. Show each as a plain-words refusal on the existing result card (no new layout). Copy: wrong_day = "This ticket is for a different day"; add_on_not_admission = "This is an add-on, it does not get anyone in"; unclassified_festival_type = "This ticket type is not set up for the door yet. Ask the organiser."; wrong_night keeps its existing wording. Unknown future result values must fall through to the existing generic refusal, never to an "admitted" look.

## Done when
- door tests updated (door.listShape, door.shortCode.matrix etc.) and new cases for the four refusals and unknown-result fallback; npm run pre-ship style checks green in CI.
- Grep proves no v1/v2 door RPC name remains in src except types.ts.
- PR bot-authored against main, body states: what changed, checks, Not verified (no live walk). Stop after the push and report.
