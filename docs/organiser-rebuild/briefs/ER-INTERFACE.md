# ER-INTERFACE: server interface pinned by the orchestrator (2026-10-21)

Website slices build and test against THESE names. ER-AD1 (admin, migrations 20261129680000-20261129720000) implements them. If AD1 must deviate, it records the change in its handover and the orchestrator updates this file; Website workers never guess.
All RPCs are `SECURITY DEFINER`, callable by an authenticated caller who passes the existing organiser checks, return `jsonb`, and signal errors with the repo's existing error-code convention (read `series.set_organisers` and `_organiser_create_allowed_v1` first). Port onto the #902 bodies; never read `person_roles.role = 'organising'`.

## 1. How to pay (no new RPC)
`payment_methods` (text, comma list of codes, order not significant) is added to `OWNER_UPSERT_KEYS` and the create keys. Codes: `ticket_link,door,bank_transfer,cash,free`. Unknown code is refused. Festival: `ticket_link` only.

## 2. Go-live check (same RPC, extended)
`series_go_live_check_v1(p_series_id)` keeps its current result shape and existing codes; ADDS blocker codes:
`no_session_first_date` (a first date has no session), `first_date_past`, `bad_session_times` (end not after start, unless next day), `no_payment`, `no_flyer`. Website reads this as the ONE publish rule (`shared/goLiveCheck.ts`).

## 3. New venue (owner-callable, draft)
`owner_create_venue_draft_v1(p_name text, p_postcode text, p_lat double precision, p_lng double precision, p_address text, p_area text)` -> `{ venue_id uuid, existing boolean }`. Sets `publish_state='draft'`, `user_id`=caller, rate-limited. An exact name+postcode match returns that venue with `existing:true`, creates nothing. Lat/lng/address/area come from the Website's postcode lookup (postcodes.io, no key).
`owner_similar_venues_v1(p_name text, p_postcode text)` -> `{ venues: [{venue_id, name, postcode}] }` (same postcode, or a shared name word) for "Is it one of these?".

## 4. Co-organisers (invite, accept)
Table `series_organiser_invites(id, series_id, invited_page_id, invited_by, status pending|accepted|declined|cancelled, created_at, responded_at)`.
- `series_invite_organiser_v1(p_series_id uuid, p_page_id uuid)` -> `{ invite_id }`. Any organiser on the event may invite. Refused: page already linked, already invited, caller not on the event.
- `series_invite_cancel_v1(p_invite_id uuid)` (inviter side), `series_invite_respond_v1(p_invite_id uuid, p_accept boolean)` (invited page's team only), `series_leave_v1(p_series_id uuid, p_page_id uuid)` (co-organiser team leaves; owner cannot), `series_remove_organiser_v1(p_series_id uuid, p_page_id uuid)` (owner team only; never the owner).
- `my_organiser_invites_v1()` -> `{ invites: [{invite_id, series_id, series_name, invited_page_id, invited_page_name, invited_by_name, created_at}] }` for Home "Invitations".
- Series read gains `organisers: [{page_id, name, role 'owner'|'co', status 'accepted'|'invited'}]`.
- Permissions: accepted co-organiser pages' teams may edit everything EXCEPT end, stop repeating, delete draft, cancel a one-off event, remove an organiser (owner team only). Version conflict -> existing `EventConflict` (`series.version`).

## 5. Festival artists
`series_festival_artists_set_v1(p_series_id uuid, p_artists jsonb)` (`[{person_id, role 'teacher'|'dj'|'performer'}]`, replaces the list) and `series_festival_artists_get_v1(p_series_id uuid)` -> same array. AD1 picks the storage (check `organiser_series_cast_v1`, `festival_meta`, `event_program_people` on an untimed item first; new table only if none fits) and records the choice. Public read returns the same list as the line-up.

## Existing, unchanged
`series.set_organisers`, `EventConflict`, owner upsert, cancel reasons (server list: Venue closed / Teacher unavailable / Bank holiday / Low signups / Other).
