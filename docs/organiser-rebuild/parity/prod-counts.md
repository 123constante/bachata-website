# Parity appendix -- prod counts and their SQL

Companion to [../PARITY-GAP.md](../PARITY-GAP.md). 2026-10-17. Read-only SELECTs on prod `stsdtacfauprzrdebmzg`; counts only, no personal data.

## Task 3 -- prod counts (SELECT only; live = lifecycle_status='live'; 0 templates exist)
L := `SELECT * FROM event_series_p5 WHERE lifecycle_status='live' AND NOT COALESCE(is_template,false)`;
items := item JOIN section ON section_id JOIN day ON day_id.

| metric | n | SQL |
|---|---|---|
| live series | **67** (+1 paused, 6 draft, 20 ended, 652 archived) | `SELECT lifecycle_status, format, count(*) FROM event_series_p5 GROUP BY 1,2` |
| live with 2+ items on one programme day | **53** | `count(DISTINCT series_id) FROM (SELECT series_id, day_id FROM items WHERE series_id IN L GROUP BY 1,2 HAVING count(*)>=2)` |
| ...of which class/masterclass + party same day | **46** | same, `HAVING bool_or(type IN ('class','masterclass','workshop')) AND bool_or(type IN ('party','social'))` |
| live with 0 items | 0 | `NOT EXISTS items` |
| max items in one day (live) | 16 | `max(count) GROUP BY series_id, day_id` |
| live item types | class 138, party 84, masterclass 8, show 1, competition 1 | `GROUP BY type` |
| multi-day / festival (live) | **7** (all format='festival'; same 7 by `_p5_series_is_multiday_v1` and by >1 date_offset_days) | `format='festival' OR festival_id IS NOT NULL OR count(DISTINCT date_offset_days)>1` |
| live with ticket/price | **51** (ticket URL 51; `passes` non-empty 3; `tickets` text 0) | `default_ticket_url` or `ticket_url` non-blank OR `jsonb_array_length(passes)>0` OR `tickets` non-blank |
| live with series lineup (people on items) | **55** | `EXISTS items JOIN event_series_program_people_p5` |
| live with per-date lineup changes | 10 | added_session_people OR session_override.people_added non-empty |
| live with any per-date override | **29** | union of occurrence_override (overridden_keys non-empty), session_override, added_session |
| ...date overrides by key (series count) | cover 25, description 21, gallery 20, venue_id 13, city_id 12, ticket_url 11, cancellation_reason 10, title 9, music_styles 5 | `unnest(overridden_keys) GROUP BY k, count(DISTINCT series_id)` |
| ...session override / time override / added session | 18 / 11 / 13 | `event_occurrence_session_override_p5` (time: start_time or end_time not null) / `event_occurrence_added_session_p5` |
| recurring vs one-off (live) | recurring **44**, one_off **10**, course 6, festival 7 | `GROUP BY format` |
| live with 2+ organisers | **5** (0 with none) | `cardinality(organiser_ids)>=2` |
| future cancelled dates | **49** all series; **6** on live series (2 series) | `lifecycle_status='cancelled' AND occurrence_date >= (now() AT TIME ZONE 'Europe/London')::date` |
| courses | **15** total (6 live, 8 ended, 1 archived) | `format='course'` |
| upcoming dates per live series, max | 58; 1 live series >100 dates total (API cap) | `count(*) GROUP BY series_id` |
| organiser memberships | entity_members organiser: 4 owner, 0 manager, 0 contributor; organiser_team_members active 50; live series with an owner/manager member: **1** | `GROUP BY member_role` |

Not computed: "published" separately from live (no published flag; lifecycle is the state). Class vs social uses
item `type`; sessions added only per date are counted in the per-date rows, not in the 53/46.

## Re-run for PARITY-GAP.md (2026-10-17, this audit)

| metric | n | SQL |
|---|---|---|
| live with gallery | 15 | `cardinality(gallery)>0` on L |
| live with video links | 14 | `cardinality(video_urls)>0` on L |
| live with Instagram | 17 | `instagram_url` non-blank on L |
| live `recurring` with no rule | 9 | `format='recurring' AND (recurrence_rule IS NULL OR recurrence_rule='null'::jsonb)` on L |
| drafts / drafts older than 7 days | 6 / 4 | `lifecycle_status='draft'` (+ `created_at < now()-interval '7 days'`) on `event_series_p5` |
| organiser WhatsApp column | none | `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND column_name ILIKE '%whatsapp%'` -> only dancer_profiles, vendors, videographers and archives |
| organiser functions mentioning WhatsApp | 0 of 4 | `position('whatsapp' in lower(pg_get_functiondef(oid)))>0` for organiser_profile_update_p5_v1, organiser_home_v1, get_organiser_public_contact_v1, get_organiser_contact_settings_v1 |

Note: on prod the series columns are `gallery`, `video_urls`, `passes`, `default_duration` (the command payload keys are `default_gallery`, `default_video_urls`, `default_passes`, `default_duration_minutes`).
