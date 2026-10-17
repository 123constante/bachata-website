# Parity appendix -- every event command x role on prod

Companion to [../PARITY-GAP.md](../PARITY-GAP.md). 2026-10-17, ticket dt_938bdec512ce. Source: read-only `pg_get_functiondef` on prod `stsdtacfauprzrdebmzg` and admin migrations at a12a21a6 (prod ledger last `20261122370000` = newest file on main). AAW = `apply_aggregate_write_p5`, last defined in `20261121040000_series_category_derived_from_programme_v1.sql` (prod line N = file line 604+N).

## Task 1 -- the gate, layer by layer
1. `series_command_p5` / `occurrence_command_p5` (prod :11 kind-prefix check, :14 -> AAW; mig
   `20261109260000_record_organiser_command_refusals_v1.sql:227/:248`, checks at :237/:258). EXECUTE: authenticated.
   AAW itself: authenticated EXECUTE = false.
2. AAW:58 `v_privileged := public.is_admin() OR auth.role()='service_role'` (mig :662). Admin skips everything below.
3. AAW:76 `IF NOT (v_req_kind = ANY (v_owner_kinds))` -> "admin-only" (mig :680). `v_owner_kinds` AAW:17-22 (mig :621) =
   upsert, add_date, remove_date, occurrence.set_time, set_lifecycle, occurrence.cancel, occurrence.set_override,
   skip_date, unskip_date, set_recurrence, stop_repeating, end_run. Payload/key allowlists AAW:90-332.
4. AAW:366 `ELSIF NOT COALESCE(v_series_orgs && public.get_current_user_organiser_ids(), false)` (mig :970).
   `get_current_user_organiser_ids` prod :23 admits `member_role IN ('owner','manager','contributor')` (baseline ~:35920).
5. AAW:406-407 for `v_owner_member_kinds` (AAW:26-29, mig :630) `_is_entity_member('series', .., ARRAY['owner','manager'])`
   (mig :1010-1011). Member kinds = set_lifecycle, occurrence.cancel, occurrence.set_override, skip_date, unskip_date,
   set_recurrence, stop_repeating, end_run.
6. Past-date refusals for non-admin AAW:414-437 (cancel/set_override/set_time/add_date/remove_date); ended-series refusal
   AAW:513-517 (mig :1117); lifecycle transitions AAW:448-451 + `_owner_lifecycle_transition_allowed_p5` prod :11-15
   (draft->pending_review|archived; rejected->draft|pending_review; live->paused|archived; paused->live|archived;
   mig `20261108190000_...:733`). Daily cap 100 success/24h AAW:457 (mig :1061; fn mig `20261109620000:69`).
7. Handler via `command_dispatch_p5` (AAW:571-576). Most handlers call `_assert_can_edit_series_p5` (prod :10 is_admin
   -> return; :34-40 legacy `organiser_team_members` active roster; :47 `_is_entity_member('series',..,ARRAY['owner','manager'])`;
   mig `20261109490000_a06_contributor_series_edit_v1.sql:86`, line :132). So **contributor is refused for every
   kind** (layer 4 lets a contributor past for the 4 W0 kinds, the handler stops them). Caveat: the legacy roster arm
   (50 active rows) compares `member_profile_id` to the auth uid -- not verified whether any match.

| command/op | what it changes | admin | owner | manager | contrib. | prod fn:line | migration file:line |
|---|---|---|---|---|---|---|---|
| series.upsert (update) | name, slug, default venue/city/start time/duration/start date/level/ticket_url/description/cover/music styles/gallery/video_urls, timezone, category*, default_passes (price), instagram_url | Y (all keys) | Y (keys AAW:43-47) | Y | N | AAW:76,366,375; `_cmd_series_upsert_p5`:85 -> assert | AAW mig :680,:970; `20261109860000_command_codes_forward_inherit_ticket_url_v1.sql:724` |
| series.upsert (create) | new series (+format, organiser_ids=1 org caller owns/manages, org live) | Y | Y | Y | N | AAW:382-396; upsert:62-82 (quota :82) | `20261109860000...:701` |
| series.upsert format/organiser_ids on existing, links (website/facebook/tiktok), group_chat, poster etc. | -- | Y | N | N | N | AAW:375-377 key allowlist | AAW mig :979 |
| series.add_date | add a date (future only for non-admin) | Y | Y | Y | N | AAW:429; `_cmd_series_add_date_p5`:19 | `20261109630000_organiser_series_date_cap_v1.sql:84` |
| series.remove_date | cancel/delete a date (future only) | Y | Y | Y | N | AAW:433-437; remove_date:14 | `20261107700000_m5_stage_e_step_c8b_stop_date_mirror_v1.sql:711` |
| occurrence.set_time | one date's start/end (writes session override/added session) | Y | Y | Y | N | AAW:425; set_time:30 | `20261121040000...:2236` |
| series.set_recurrence | weekly rule (recurring only, not ended) | Y | Y | Y | N | AAW:406,526-541; handler:11 | `00000000000000_baseline_prod_schema_v1.sql:1233` (no later CREATE) |
| series.set_lifecycle publish(draft->pending_review)/pause/resume/archive | lifecycle | Y (any, incl. ended) | Y (owner transitions only) | Y | N | AAW:406,448-451,504; handler:38 (ended admin-only), :50-51 (archive), :56 | `20261120030000_direct_end_refuses_open_today_v1.sql:239,251,257` |
| series.end_run | end series | Y | Y | Y | N | AAW:406; `_cmd_series_end_run_p5`:35-36 | `20261120010000_series_end_run_today_session_v1.sql:123` |
| series.stop_repeating | stop recurrence | Y | Y | Y | N | AAW:406; handler:15 | `20261107700000...:888` |
| series.skip_date / unskip_date | skip (break) a date / undo | Y | Y | Y | N | AAW:406; skip:11, unskip:15 | `20261107700000...:790`; `20260823140000_series_break_authoring_p5_v1.sql:239` |
| occurrence.cancel | cancel/un-cancel a date (+reason) | Y | Y (future; un-cancel capped) | Y | N | AAW:406,414; cancel:25, :75 | `20261109880000_cancel_reason_soft_rule_v1.sql:283` |
| occurrence.set_override | per-date venue_id, city_id, cancellation_reason_label, cover_image_url, ticket_url, description (AAW:35-36) | Y (+title, level, organiser_ids, music_styles, gallery, passes, promo_codes, featured, lifecycle) | Y (6 keys, future dates) | Y | N | AAW:100,406,414,440; set_override:16 | `20261109860000...:1022` |
| occurrence.set_session_delta | per-date programme (sessions, people, rooms, style, track) | Y | N via dispatcher | N | N | AAW:76; handler:17 | `20261121040000...:2065` |
| series.set_program | whole-series programme/lineup | Y | N | N | N | AAW:76; handler:20 | `20261107680000_m5_stage_e_step_c7b_stop_programme_mirror_v1.sql:76` |
| series.apply_forward_from | push a date's edits forward | Y | N | N | N | AAW:76; handler:36 | `20261109860000...:407` |
| series.set_organisers | organiser list | Y | N | N | N | handler:12 `IF NOT public.is_admin()` | `20261105860000_organiser_link_writes_p5_v1.sql:50` |
| series.set_rooms | rooms | Y | N | N | N | handler:13 | `20261107900000_m4_step5_series_set_rooms_group_chat_kinds_v1.sql:36` |
| series.set_group_chat | group chat link | Y | N | N | N | handler:10 | same file :111 |
| series.restore_ended | un-end | Y | N | N | N | handler:31 | `20260907200000_p2a_series_restore_ended_verb_v1.sql:206` |
| occurrence.move_date | move a date | not on prod | -- | -- | -- | absent from dispatch | none |
| **organiser_set_occurrence_programme_v1** | ONE date's sessions: type, title, start/end, ends_next_day, level_keys, removed, new sessions; people_add/remove (teaching/djing, <=12) | Y | Y | Y | N | :101-104 `v_admin OR _is_entity_member('series',..,['owner','manager'])`; keys :19-20,:152; refusals :252 ended/archived, :255-258 multi-day/festival, :260 cancelled date, :263 past; cap :233 | `20261121040000...:1287` (gate :1390) |
| organiser_get_occurrence_programme_v1 | read same | Y | Y | Y | N | :27 | `20261109750000_organiser_programme_reader_people_v1.sql:93` |
| organiser_undo_last_change_v1 | undo last change on series | Y | Y | Y | N | :38 | `20261109650000_organiser_caps_followup_a0d_v1.sql:699` |
| admin_bulk_occurrence_command_p5 (bulk_cancel, bulk_shift) | many dates | Y | Y** | Y** | N | :75 `_can_act_as_organiser_p5` (admits contributor), :127 `_assert_can_edit_series_p5` | `20261107700000...:1380` |
| admin_collapse_series_to_one_off_p5 | recurring->one-off | Y | Y** | Y** | N | :30, :66 | `20261107700000...:1951` |
| admin_duplicate_event_p5 / admin_delete_series_p5_v1 | duplicate / delete | Y | N | N | N | :41 / :19 | `20261105310000...:62` |
| organiser_profile_update_p5_v1 | organiser profile | Y | Y | Y | N | :48 | `20261112040000...:574` (EXECUTE string) |

\* category is accepted but derived from sessions (event-truth P2). \*\* "admin_"-named but EXECUTE to authenticated and
gated owner/manager(+legacy roster); Website does not call them. Not separately settable by an organiser at all:
tickets text, payment_methods, promo_codes, website/facebook/tiktok/livestream links, poster, guest list, raffle,
series-level lineup/programme, organisers, rooms, series-level `ticket_url`/`passes` columns (only `default_*` keys).


## Website callers

Both trees: `series_command_p5`, `occurrence_command_p5`, `organiser_get_occurrence_programme_v1`,
`organiser_set_occurrence_programme_v1`, `organiser_search_people_v1`, `admin_event_workspace_p5`, `event_view_p5`,
`organiser_profile_update_p5_v1`, `organiser_home_v1`, `organiser_ownership_v1`, `organiser_team_v1`,
`organiser_team_set_member_v1`, `organiser_team_add_member_by_profile_v1`, `organiser_team_search_people_v1`,
`organiser_transfer_ownership_v1`, `remove_organiser_member_v1`, `request_/list_/resolve_organiser_access_request(s)_v1`,
`list_my_organiser_access_requests_v1`, `claim_organiser_v1`, `create_organiser_profile_v1`, `submit_organiser_profile_v1`,
`organiser_claim_hints_v1`, `get_organiser_venue_options_v1`, `get_organiser_contact_settings_v1`,
`get_organiser_public_contact_v1`, `get_public_dancer_names_v1`, `search_cities`, `get_current_user_organiser_ids`.
Only web-main: `event_publish_readiness_v1`. Only branch: `organiser_team_browse_people_v1`, `_my_dancer_profile_id_v1`,
`dancer_area_gate_v1`, `my_account_deletion_status_v1`.
Command kinds sent (both): series.upsert/add_date/remove_date/skip_date/unskip_date/set_lifecycle/set_recurrence/
stop_repeating/end_run, occurrence.set_time/cancel/set_override. **Branch also sends `occurrence.move_date`**
(`shared/seriesCommands.ts:19,248`, comment "D39 (admin A1)") -- **NOT on prod**: not in `command_dispatch_p5`, not in
`v_owner_kinds` -> an organiser gets `permission_denied: occurrence.move_date is admin-only` (AAW:76-77).

