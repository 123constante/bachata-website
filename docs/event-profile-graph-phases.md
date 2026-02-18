# Event ↔ Profile Graph Rollout

## Phase 1 (done in code)
- Add `event_profile_connections` table.
- Add privacy baseline:
  - public can read non-dancer links
  - dancer links require logged-in user
- Add RPCs:
  - `get_event_profile_connections(p_event_id)`
  - `get_profile_event_timeline(p_person_type, p_person_id, p_limit, p_offset)`
  - `upsert_event_profile_connection(...)`

## Phase 2 (Event page integration)
- On event detail page, fetch `get_event_profile_connections(event_id)`.
- Render grouped sections in this order:
  1. Organisers
  2. Teachers
  3. DJs
  4. Vendors
  5. Videographers
  6. Attendees
- Each person card shows role chip + open profile action.
- Dancer cards visible to all, but opening dancer profile should redirect to auth when not logged in.

## Phase 3 (Profile timeline integration)
- On each profile page, fetch `get_profile_event_timeline(...)`.
- Render timeline cards (option A selected):
  - Date/time
  - Event name
  - City/location
  - Connection badge (`attending`, `teaching`, etc.)
  - CTA: open event

## Phase 4 (permissions tightening + moderation)
- Restrict write RPC to admins, event owners, or organisers with ownership links.
- Permission checks now align with person identity linking (`can_current_user_manage_profile`) and legacy organiser claims.
- Add moderation/flagging if needed.
- Add analytics:
  - `event_people_section_opened`
  - `event_person_profile_clicked`
  - `profile_timeline_event_clicked`

## Notes
- Current Phase 1 schema is intentionally generic and role-agnostic.
- Frontend can group labels for display:
  - `performing_dj` => "Performing DJ"
  - `vendor_partner` => "Vendor/Partner"
