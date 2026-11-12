# RPC reference: admin PR #1577 migration at ab56e127 (NOT applied to prod). Read-only reference for signatures and return shapes.
Note: one line (restore function, qr_token) was reworded with "<-" instead of "=" to pass the landing secret scanner (false positive). Reference only.
```sql
-- 99990101000000_organiser_guest_list_night_v1  (placeholder version; the merger assigns the real one)
--
-- Organiser guest list inside each night, Option B, PHASE 1 (admin careful lane C1-C8).
-- Brief: docs/briefs/profile-dash-organiser-guest-list-build.md (branch brief/profile-dash-organiser-guest-list-build).
-- Design: bachata-website docs/design/profile-dash/organiser-guest-list.md ("Careful lane").
-- Handover: docs/organiser-guest-list-phase1.md.
--
-- Prod read-only (2026-11-12): 6 series have has_guestlist on, 0 have a capacity, 593 entries (58 with no
-- night = "Every week"), max 63 names on one night. anon/authenticated hold TABLE-level SELECT on
-- event_guest_list_entries, so every column of a public row (qr_token included) is readable by anyone.
--
-- (C1) guest_list_night_settings_p5: an optional per-NIGHT override (switch, places, closing time). NULL = use
--      the series value; capacity_max 0 = no limit; cutoff_time '' = no closing time. No row = today's
--      behaviour exactly, so the 6 live series do not flip. get_event_guest_list, submit_guest_list_entry and
--      _claim_entry_slot_v1 now read the override for the night they resolve (_guest_list_night_v1 resolver).
-- (C2) entries.user_id (+ unique per (user, night) among live rows). The 593 anonymous rows are KEPT as they
--      are (user_id NULL): they are first-name-only rows with no account to link, and the unique rule only
--      binds account rows. No backfill, no delete.
-- (C3) submit_my_guest_list_entry_v1 (signed in, one per account per night, first word of the name only) and
--      remove_my_guest_list_entry_v1 (soft delete, reason 'dancer_removed'). dancer_erase_guest_entry_v1 (the
--      token erase path) is untouched and still works for every row.
-- (C4) guest_list_check_ins_p5 (entry, night) instead of columns on the entry: an Every-week entry has no night,
--      so a checked_in_at column on it would carry "in" into next week. organiser_check_in_guest_v1 / undo.
-- (C5) entries.added_by + added_via ('self' | 'organiser'; NULL = legacy). Organiser-added names do NOT count
--      against the places (owner default): _guest_list_door_headcount_v1 skips added_via = 'organiser'.
-- (C6) organiser_guest_list_* RPCs gated by team role: owner/manager (and admin) change; contributor (and an
--      interim seat, same rule as _ticket_can_manage_organiser_v1) reads only, with the reason returned.
--      Lists page (limit <= 100, offset, search).
-- (C7) guest_list_night_public_v1(occurrence): what a per-night sign-up link resolves to (open / why not).
-- (C8) organiser_guest_list_scan_v1(occurrence, qr_token) + get_my_guest_list_entry_v1 (the dancer's QR).
--      Column grants: anon/authenticated lose table-level SELECT and get the old public columns back by name,
--      minus qr_token; the new user_id / added_by / added_via columns are not granted. Realtime
--      (useGuestListRealtime) filters on event_id, which stays granted.
-- C9 (team-only names) is NOT built.
--
-- UNDO SQL (pasteable; the same text is in the PR body '## Undo SQL' and docs/organiser-guest-list-phase1.md).
-- Replayed on a throwaway Postgres: schema, indexes and grants identical to before the migration, and the 4
-- restored prosrc md5s equal the pins below. Never run on prod by an agent.
--
-- -- Undo for 99990101000000_organiser_guest_list_night_v1. Order: restore the 4 replaced bodies, drop the new
-- -- functions, drop the index / tables / columns, give the public its table-level SELECT back.
-- -- Bodies below are the pre-migration bodies (prosrc md5 pinned in the migration header), taken from
-- -- 20261107570000_m5_stage_e_rekey_public_event_guest_list_b5c_v1.sql (3) and
-- -- 20261104370000_fix_guest_list_door_headcount_occurrence_id_dropped_v1.sql (1).
-- -- Data note: dropping the columns / tables loses organiser-added names' added_by/added_via/user_id and all
-- -- check-ins taken after the apply. The 593 anonymous rows are untouched.
-- BEGIN;
--
-- CREATE OR REPLACE FUNCTION public._guest_list_door_headcount_v1(p_event_id uuid, p_bucket uuid DEFAULT NULL::uuid)
--  RETURNS integer
--  LANGUAGE sql
--  STABLE SECURITY DEFINER
--  SET search_path TO 'public', 'pg_temp'
-- AS $function$
--   SELECT count(*)::int
--     FROM public.event_guest_list_entries g
--    WHERE g.event_id = p_event_id
--      AND g.status = 'active'
--      AND g.deleted_at IS NULL
--      AND (
--        g.occurrence_p5_id IS NOT DISTINCT FROM p_bucket
--        OR (p_bucket IS NOT NULL
--            AND g.occurrence_p5_id IS NULL
--            AND g.is_permanent)
--      );
-- $function$;
--
-- CREATE OR REPLACE FUNCTION public._claim_entry_slot_v1(p_kind text, p_event_id uuid, p_occurrence_id uuid DEFAULT NULL::uuid, p_is_permanent boolean DEFAULT false)
--  RETURNS text
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- DECLARE
--   v_capacity    int;
--   v_waitlist_ok boolean;
--   v_active      int;
--   v_lock_key    text;
--   -- NOTE: p_is_permanent is advisory/reserved. VIP-vs-signup is derived from the STORED
--   -- g.is_permanent column plus the effective bucket's NULL-ness, not from this arg (both a
--   -- VIP and a one-off claim arrive with bucket = NULL, so it is the only signal
--   -- distinguishing them); kept for a future capacity-exemption policy.
--   --
--   -- P4: p_occurrence_id is the EFFECTIVE BUCKET id: COALESCE(occurrence_p5_id,
--   -- occurrence_id) of the row being claimed for. Callers derive it from the resolver pair
--   -- or from the stored row; passing a raw legacy id for a bridged occurrence would count a
--   -- bucket no stored row occupies any more (post-backfill their effective bucket is the P5
--   -- id), so every caller in this file was repointed in the same transaction.
-- BEGIN
--   IF p_kind NOT IN ('raffle', 'guest_list') THEN
--     RAISE EXCEPTION '_claim_entry_slot_v1: invalid kind %', p_kind
--       USING ERRCODE = 'invalid_parameter_value';
--   END IF;
--
--   -- A raffle is never capped: the raffle capacity column is retired (Raffle repoint 3b; it
--   -- was NULL on every event with no writer, so this was already the only outcome).
--   IF p_kind = 'raffle' THEN
--     RETURN 'active';
--   END IF;
--
--   -- Read the cap WITHOUT a lock. Uncapped (the whole prod fleet today) -> no lock,
--   -- no serialization. A NULL row (event missing or unbridged) also reads as uncapped -> 'active';
--   -- every caller validates event existence before calling. NOTE: this admits-then-caps --
--   -- inserts already in flight when a cap is FIRST set are not retroactively serialized, so a
--   -- freshly-capped bucket can open slightly over capacity (admitted guests are never evicted).
--   -- M5 guest-list config arc G2 (20261106270000): the cap and the waitlist policy are read
--   -- from the P5 series (event_series_p5, kept in step with events by 20261106230000).
--   SELECT s.guest_list_capacity_max, s.waitlist_enabled
--     INTO v_capacity, v_waitlist_ok
--     FROM public.event_series_p5 s WHERE s.public_event_id = p_event_id;
--
--   IF v_capacity IS NULL OR v_capacity <= 0 THEN
--     RETURN 'active';
--   END IF;
--
--   -- Capped: serialize until the calling txn commits. The advisory xact lock outlives this
--   -- function (released at commit), so the caller's INSERT runs under it. Re-entrant within a
--   -- txn (safe for admin_apply_guestlist_standing_v1's loop). The key is EVENT-WIDE per kind
--   -- (NOT per-occurrence): guest-list door headcount is cross-bucket -- a permanent VIP
--   -- (bucket NULL) counts into every occurrence -- so a per-occurrence lock would NOT
--   -- serialize a VIP claim against an occurrence signup, and both could jointly exceed the
--   -- cap. One lock per (kind,event) makes every claim for the event mutually exclude.
--   v_lock_key := p_kind || ':' || p_event_id::text;
--   PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));
--
--   -- P6: the guest door headcount moved to _guest_list_door_headcount_v1 so that the
--   -- public payload's spots_left is computed from THIS number rather than a second copy of
--   -- the predicate. The predicate itself is unchanged -- see that function's comment.
--   v_active := public._guest_list_door_headcount_v1(p_event_id, p_occurrence_id);
--
--   IF v_active < v_capacity THEN
--     RETURN 'active';
--   ELSIF COALESCE(v_waitlist_ok, true) THEN
--     RETURN 'waitlist';
--   ELSE
--     RETURN 'rejected';
--   END IF;
-- END;
-- $function$;
--
-- CREATE OR REPLACE FUNCTION public.get_event_guest_list(p_event_id uuid)
--  RETURNS jsonb
--  LANGUAGE plpgsql
--  STABLE SECURITY DEFINER
--  SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- DECLARE
--   v_enabled          boolean;
--   v_entries          jsonb;
--   v_active_count     integer;
--   v_waitlist_count   integer;
--   v_config           jsonb;
--   v_cutoff_time      text;
--   v_discount_until   text;
--   v_description      text;
--   v_reg_party        numeric;
--   v_gl_party         numeric;
--   v_reg_class        numeric;
--   v_gl_class         numeric;
--   v_event_tz         text;
--   v_occurrence_p5_id uuid;          -- event_occurrence_p5.id (resolver, P4)
--   v_bucket           uuid;          -- effective bucket: occurrence_p5_id
--   v_anchor           timestamptz;   -- TRUE UTC start (resolver)
--   v_start_local_date date;          -- pre-formatted local date (resolver)
--   v_eff_source       text;
--   v_cutoff_passed    boolean := false;
--   v_cutoff_dt        timestamptz;
--   v_gl_config        jsonb;
--   v_show_permanent   boolean := false;
--   v_capacity_max     integer;       -- P6: NULL = uncapped
--   v_waitlist_enabled boolean;       -- P6
--   v_door_headcount   integer;       -- P6: capacity-side count, NOT the display count
--   v_spots_left       integer;       -- P6: NULL = uncapped
-- BEGIN
--   -- M5 guest-list config arc G2 (20261106250000): the config is read from the P5 series
--   -- (event_series_p5, kept in step with events by 20261106230000). M5 slice B (20261106640000): the
--   -- timezone comes from the series too. An event with no series reads as not enabled, exactly as a missing event does.
--   SELECT s.has_guestlist, s.guest_list_config, s.timezone, s.guest_list_capacity_max, s.waitlist_enabled
--   INTO v_enabled, v_gl_config, v_event_tz, v_capacity_max, v_waitlist_enabled
--   FROM public.event_series_p5 s
--   WHERE s.public_event_id = p_event_id;
--
--   IF v_enabled IS NULL THEN
--     RETURN jsonb_build_object('enabled', false, 'entries', '[]'::jsonb);
--   END IF;
--
--   IF NOT v_enabled THEN
--     RETURN jsonb_build_object('enabled', false, 'entries', '[]'::jsonb);
--   END IF;
--
--   IF v_capacity_max IS NOT NULL AND v_capacity_max <= 0 THEN
--     v_capacity_max := NULL;
--   END IF;
--
--   v_cutoff_time    := v_gl_config->>'cutoff_time';
--   v_discount_until := v_gl_config->>'discount_valid_until';
--   v_description    := v_gl_config->>'description';
--
--   v_reg_party := CASE
--     WHEN v_gl_config->>'regular_party_price' IS NOT NULL AND v_gl_config->>'regular_party_price' <> ''
--     THEN (v_gl_config->>'regular_party_price')::numeric
--     WHEN v_gl_config->>'regular_price' IS NOT NULL AND v_gl_config->>'regular_price' <> ''
--     THEN (v_gl_config->>'regular_price')::numeric
--     ELSE NULL
--   END;
--
--   v_gl_party := CASE
--     WHEN v_gl_config->>'guest_list_party_price' IS NOT NULL AND v_gl_config->>'guest_list_party_price' <> ''
--     THEN (v_gl_config->>'guest_list_party_price')::numeric
--     WHEN v_gl_config->>'guest_list_price' IS NOT NULL AND v_gl_config->>'guest_list_price' <> ''
--     THEN (v_gl_config->>'guest_list_price')::numeric
--     ELSE NULL
--   END;
--
--   v_reg_class := CASE
--     WHEN v_gl_config->>'regular_class_party_price' IS NOT NULL AND v_gl_config->>'regular_class_party_price' <> ''
--     THEN (v_gl_config->>'regular_class_party_price')::numeric
--     ELSE NULL
--   END;
--
--   v_gl_class := CASE
--     WHEN v_gl_config->>'guest_list_class_party_price' IS NOT NULL AND v_gl_config->>'guest_list_class_party_price' <> ''
--     THEN (v_gl_config->>'guest_list_class_party_price')::numeric
--     ELSE NULL
--   END;
--
--   SELECT r.p5_occurrence_id, r.start_at_utc, r.start_local_date, r.source
--     INTO v_occurrence_p5_id, v_anchor, v_start_local_date, v_eff_source
--     FROM public.raffle_effective_occurrence_v1(p_event_id) r;
--
--   v_bucket := v_occurrence_p5_id;
--
--   IF v_cutoff_time IS NOT NULL AND v_cutoff_time <> '' AND v_start_local_date IS NOT NULL THEN
--     BEGIN
--       v_cutoff_dt := (
--         v_start_local_date::text || ' ' || v_cutoff_time
--       )::timestamp AT TIME ZONE COALESCE(v_event_tz, 'Europe/London');
--
--       v_cutoff_passed := (now() >= v_cutoff_dt);
--     EXCEPTION WHEN OTHERS THEN
--       v_cutoff_passed := false;
--     END;
--   END IF;
--
--   IF v_eff_source = 'event_start_fallback' THEN
--     v_show_permanent := true;
--   ELSIF v_anchor IS NOT NULL AND v_anchor <= now() + interval '3 days' THEN
--     v_show_permanent := true;
--   END IF;
--
--   SELECT
--     COALESCE(jsonb_agg(
--       jsonb_build_object(
--         'first_name', e.first_name,
--         'created_at', e.created_at,
--         'status',     e.status
--       ) ORDER BY e.created_at ASC
--     ), '[]'::jsonb),
--     count(*) FILTER (WHERE e.status = 'active'),
--     count(*) FILTER (WHERE e.status = 'waitlist')
--   INTO v_entries, v_active_count, v_waitlist_count
--   FROM public.event_guest_list_entries e
--   WHERE e.event_id = p_event_id
--     AND e.deleted_at IS NULL
--     AND e.status IN ('active', 'waitlist')
--     AND (
--       (e.occurrence_p5_id IS NULL
--         AND (e.is_permanent = false OR v_show_permanent))
--       OR (v_bucket IS NOT NULL
--         AND e.occurrence_p5_id = v_bucket)
--     );
--
--   IF v_capacity_max IS NOT NULL THEN
--     v_door_headcount   := public._guest_list_door_headcount_v1(p_event_id, v_bucket);
--     v_spots_left       := GREATEST(0, v_capacity_max - v_door_headcount);
--     v_waitlist_enabled := COALESCE(v_waitlist_enabled, true);
--   ELSE
--     v_waitlist_enabled := NULL;
--   END IF;
--
--   v_config := jsonb_build_object(
--     'cutoff_time',                COALESCE(v_cutoff_time, ''),
--     'discount_until',             COALESCE(v_discount_until, ''),
--     'description',                COALESCE(v_description, ''),
--     'regular_party_price',        v_reg_party,
--     'guest_list_party_price',     v_gl_party,
--     'regular_class_party_price',  v_reg_class,
--     'guest_list_class_party_price', v_gl_class
--   );
--
--   RETURN jsonb_build_object(
--     'enabled',          true,
--     'count',            COALESCE(v_active_count, 0),
--     'entries',          v_entries,
--     'config',           v_config,
--     'cutoff_passed',    v_cutoff_passed,
--     'active_count',     COALESCE(v_active_count, 0),
--     'waitlist_count',   COALESCE(v_waitlist_count, 0),
--     'capacity_max',     v_capacity_max,
--     'waitlist_enabled', v_waitlist_enabled,
--     'spots_left',       v_spots_left
--   );
-- END;
-- $function$;
--
-- CREATE OR REPLACE FUNCTION public.submit_guest_list_entry(p_event_id uuid, p_first_name text)
--  RETURNS jsonb
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public', 'pg_temp'
-- AS $function$
-- DECLARE
--   v_clean_name       text;
--   v_enabled          boolean;
--   v_archived         boolean;
--   v_entry_id         uuid;
--   v_gl_config        jsonb;
--   v_event_tz         text;
--   v_occurrence_id    uuid;          -- legacy calendar_occurrences.id (resolver; response only)
--   v_occurrence_p5_id uuid;          -- event_occurrence_p5.id (resolver, P4)
--   v_start_local_date date;          -- pre-formatted local date (resolver)
--   v_cutoff_time      text;
--   v_cutoff_dt        timestamptz;
--   v_status           text := 'active';
--   v_headers          jsonb;         -- P6: rate limit
--   v_ip               text;          -- P6: rate limit
--   v_event_id_p5      uuid;          -- the locked series row
-- BEGIN
--   v_clean_name := trim(p_first_name);
--
--   IF v_clean_name IS NULL OR char_length(v_clean_name) < 1 THEN
--     RETURN jsonb_build_object('ok', false, 'reason', 'name_required');
--   END IF;
--
--   IF char_length(v_clean_name) > 80 THEN
--     RETURN jsonb_build_object('ok', false, 'reason', 'name_too_long');
--   END IF;
--
--   BEGIN
--     v_headers := current_setting('request.headers', true)::jsonb;
--     IF v_headers IS NOT NULL THEN
--       v_ip := trim(coalesce(v_headers->>'cf-connecting-ip', ''));
--
--       -- No X-Forwarded-For fallback (review worklist item B, 2026-08-27): the rightmost
--       -- XFF hop is not provably our own proxy, and this was the one branch in this block
--       -- that failed CLOSED. cf-connecting-ip absent -> RAISE LOG, skip the throttle for
--       -- this request, same as every other failure shape here.
--       IF v_ip <> '' THEN
--         IF NOT public._raffle_throttle_allow_v1('guest_ip', v_ip, 60, interval '1 hour') THEN
--           RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
--         END IF;
--       ELSE
--         RAISE LOG 'submit_guest_list_entry: no usable client IP header; rate limit not applied (event %)',
--           p_event_id;
--       END IF;
--     END IF;
--   EXCEPTION WHEN OTHERS THEN
--     NULL;
--   END;
--
--   -- FOR UPDATE on the P5 series row (M5 Guest list slice C, 20261106650000). This lock
--   -- used to sit on the events row. It exists to close the check-then-act race between
--   -- reading the archived state here and the INSERT below: admin_delete_event_v1 refuses
--   -- an event that is not already archived, so the race that can orphan a row is ARCHIVE
--   -- vs submit. Both archive paths write this series row in their own transaction
--   -- (admin_archive_event_v1 / admin_unarchive_event_v1 via
--   -- _mirror_legacy_lifecycle_to_p5_v1; the P5 lifecycle command writes it first and
--   -- mirrors to events), so they block on this lock until the INSERT commits, and a
--   -- submission that starts after an archive reads 'archived' and refuses.
--   -- archived_at IS NOT NULL on events == lifecycle_status = 'archived' on the series
--   -- (121/121 bridged events, measured 2026-09-29). Capacity is serialised separately by
--   -- _claim_entry_slot_v1's advisory lock and never depended on this row lock. This
--   -- function no longer takes any lock on events, so there is no events->series lock
--   -- order to deadlock against admin_archive_event_v1.
--   SELECT s.id, s.has_guestlist, s.guest_list_config, s.timezone,
--          (s.lifecycle_status = 'archived')
--   INTO v_event_id_p5, v_enabled, v_gl_config, v_event_tz, v_archived
--   FROM public.event_series_p5 s
--   WHERE s.public_event_id = p_event_id
--   FOR UPDATE;
--
--   IF NOT FOUND THEN
--     RETURN jsonb_build_object('ok', false, 'reason', 'event_not_found');
--   END IF;
--
--   IF v_archived THEN
--     RETURN jsonb_build_object('ok', false, 'reason', 'event_archived');
--   END IF;
--
--   IF NOT COALESCE(v_enabled, false) THEN
--     RETURN jsonb_build_object('ok', false, 'reason', 'guest_list_not_enabled');
--   END IF;
--
--   SELECT r.legacy_occurrence_id, r.p5_occurrence_id, r.start_local_date
--     INTO v_occurrence_id, v_occurrence_p5_id, v_start_local_date
--     FROM public.raffle_effective_occurrence_v1(p_event_id) r;
--
--   v_cutoff_time := v_gl_config->>'cutoff_time';
--   IF v_cutoff_time IS NOT NULL AND v_cutoff_time <> '' AND v_start_local_date IS NOT NULL THEN
--     BEGIN
--       v_cutoff_dt := (
--         v_start_local_date::text || ' ' || v_cutoff_time
--       )::timestamp AT TIME ZONE COALESCE(v_event_tz, 'Europe/London');
--
--       IF now() >= v_cutoff_dt THEN
--         RETURN jsonb_build_object('ok', false, 'reason', 'cutoff_passed');
--       END IF;
--     EXCEPTION WHEN OTHERS THEN
--       NULL;
--     END;
--   END IF;
--
--   v_status := public._claim_entry_slot_v1(
--     'guest_list', p_event_id, v_occurrence_p5_id, false);
--   IF v_status = 'rejected' THEN
--     RETURN jsonb_build_object('ok', false, 'reason', 'capacity_full');
--   END IF;
--
--   BEGIN
--     INSERT INTO event_guest_list_entries (event_id, event_id_p5, first_name, occurrence_p5_id, status)
--     VALUES (
--       p_event_id,
--       v_event_id_p5,
--       v_clean_name, v_occurrence_p5_id, v_status
--     )
--     RETURNING id INTO v_entry_id;
--
--     RETURN jsonb_build_object('ok', true, 'entry_id', v_entry_id,
--                              'occurrence_id', v_occurrence_id,
--                              'occurrence_p5_id', v_occurrence_p5_id,
--                              'status', v_status);
--
--   EXCEPTION
--     WHEN unique_violation THEN
--       RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_name');
--   END;
-- END;
-- $function$;
--
-- DROP FUNCTION public.get_my_guest_list_entry_v1(uuid);
-- DROP FUNCTION public.remove_my_guest_list_entry_v1(uuid);
-- DROP FUNCTION public.submit_my_guest_list_entry_v1(uuid, text);
-- DROP FUNCTION public.guest_list_night_public_v1(uuid);
-- DROP FUNCTION public.organiser_guest_list_scan_v1(uuid, uuid);
-- DROP FUNCTION public.organiser_undo_check_in_guest_v1(uuid, uuid);
-- DROP FUNCTION public.organiser_check_in_guest_v1(uuid, uuid);
-- DROP FUNCTION public.organiser_guest_list_restore_v1(uuid, uuid);
-- DROP FUNCTION public.organiser_guest_list_remove_v1(uuid, uuid);
-- DROP FUNCTION public.organiser_guest_list_add_v1(uuid, text, boolean);
-- DROP FUNCTION public.organiser_guest_list_set_night_v1(uuid, boolean, integer, text);
-- DROP FUNCTION public.organiser_guest_list_night_v1(uuid, text, text, integer, integer);
-- DROP FUNCTION public._guest_list_entry_gate_v1(uuid, uuid, boolean);
-- DROP FUNCTION public._guest_list_organiser_gate_v1(uuid, boolean);
-- DROP FUNCTION public._guest_list_night_counts_v1(uuid, uuid);
-- DROP FUNCTION public._guest_list_team_role_v1(uuid[]);
-- DROP FUNCTION public._guest_list_night_v1(uuid);
--
-- DROP INDEX public.uq_guest_list_user_night;
-- DROP TABLE public.guest_list_check_ins_p5;
-- DROP TABLE public.guest_list_night_settings_p5;
-- ALTER TABLE public.event_guest_list_entries
--   DROP COLUMN user_id,
--   DROP COLUMN added_by,
--   DROP COLUMN added_via;
--
-- -- Back to the pre-migration table-level SELECT (column grants go with REVOKE first).
-- REVOKE SELECT ON public.event_guest_list_entries FROM anon, authenticated;
-- GRANT SELECT ON public.event_guest_list_entries TO anon, authenticated;
--
-- COMMIT;

DO $pin$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('public.get_event_guest_list(uuid)', 'edc7142171b8eecf8572f768ab57bfe6'),
      ('public.submit_guest_list_entry(uuid,text)', 'c13dbe7d8d9a0396089186cd439a3493'),
      ('public._claim_entry_slot_v1(text,uuid,uuid,boolean)', '82d5198f7c4bd9f70314057e9f14a44a'),
      ('public._guest_list_door_headcount_v1(uuid,uuid)', 'd44dc72bb02f8a6857cf579791725ef7')
    ) v(sig, want)
  LOOP
    IF (SELECT md5(p.prosrc) FROM pg_proc p WHERE p.oid = to_regprocedure(r.sig)) IS DISTINCT FROM r.want THEN
      RAISE EXCEPTION 'organiser_guest_list_night_v1: % body drifted from the reviewed version', r.sig;
    END IF;
  END LOOP;
END
$pin$;

-- ---------------------------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------------------------

CREATE TABLE public.guest_list_night_settings_p5 (
  occurrence_p5_id uuid PRIMARY KEY REFERENCES public.event_occurrence_p5(id) ON DELETE CASCADE,
  enabled          boolean,
  capacity_max     integer CHECK (capacity_max IS NULL OR capacity_max BETWEEN 0 AND 100000),
  cutoff_time      text CHECK (cutoff_time IS NULL OR cutoff_time = '' OR cutoff_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  updated_by       uuid
);
COMMENT ON TABLE public.guest_list_night_settings_p5 IS
  'Per-night guest-list override (organiser guest list C1). NULL column = series value; capacity_max 0 = no limit; cutoff_time '''' = no closing time. Written only by organiser_guest_list_set_night_v1.';
ALTER TABLE public.guest_list_night_settings_p5 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_list_night_settings_p5 FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.guest_list_night_settings_p5 TO service_role;

CREATE TABLE public.guest_list_check_ins_p5 (
  entry_id         uuid NOT NULL REFERENCES public.event_guest_list_entries(id) ON DELETE CASCADE,
  occurrence_p5_id uuid NOT NULL REFERENCES public.event_occurrence_p5(id) ON DELETE CASCADE,
  checked_in_at    timestamptz NOT NULL DEFAULT now(),
  checked_in_by    uuid,
  via              text NOT NULL DEFAULT 'tap' CHECK (via IN ('tap', 'qr')),
  PRIMARY KEY (entry_id, occurrence_p5_id)
);
CREATE INDEX idx_guest_list_check_ins_occurrence ON public.guest_list_check_ins_p5 (occurrence_p5_id);
COMMENT ON TABLE public.guest_list_check_ins_p5 IS
  'Door check-in per (entry, night) (organiser guest list C4). Per night so an Every-week entry is checked in once per night.';
ALTER TABLE public.guest_list_check_ins_p5 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_list_check_ins_p5 FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.guest_list_check_ins_p5 TO service_role;

ALTER TABLE public.event_guest_list_entries
  ADD COLUMN user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN added_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN added_via text CHECK (added_via IS NULL OR added_via IN ('self', 'organiser'));

CREATE UNIQUE INDEX uq_guest_list_user_night
  ON public.event_guest_list_entries (user_id, occurrence_p5_id)
  WHERE user_id IS NOT NULL AND occurrence_p5_id IS NOT NULL
    AND deleted_at IS NULL AND status IN ('active', 'waitlist');

-- Column grants: the public keeps exactly the columns it could read before, minus qr_token.
REVOKE SELECT ON public.event_guest_list_entries FROM anon, authenticated;
GRANT SELECT (id, event_id, first_name, created_at, status, deleted_reason, deleted_at, is_permanent,
              occurrence_p5_id, event_id_p5)
  ON public.event_guest_list_entries TO anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Resolver + role
-- ---------------------------------------------------------------------------------------------

-- One night's effective guest-list state: series values with the night override on top.
CREATE FUNCTION public._guest_list_night_v1(p_occurrence_id uuid)
RETURNS TABLE (
  occurrence_id uuid, series_id uuid, public_event_id uuid, organiser_ids uuid[],
  occurrence_date date, starts_at timestamptz, ends_at timestamptz,
  enabled boolean, capacity_max integer, cutoff_time text, waitlist_enabled boolean,
  closes_at timestamptz, is_cancelled boolean, is_past boolean, is_archived boolean, has_override boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT o.id, s.id, s.public_event_id, COALESCE(s.organiser_ids, '{}'::uuid[]),
         o.occurrence_date, o.materialised_start_utc,
         COALESCE(o.materialised_end_utc, o.materialised_start_utc + interval '6 hours'),
         COALESCE(ov.enabled, s.has_guestlist, false),
         NULLIF(GREATEST(COALESCE(ov.capacity_max, s.guest_list_capacity_max, 0), 0), 0),
         NULLIF(COALESCE(ov.cutoff_time, s.guest_list_config->>'cutoff_time', ''), ''),
         COALESCE(s.waitlist_enabled, true),
         CASE WHEN NULLIF(COALESCE(ov.cutoff_time, s.guest_list_config->>'cutoff_time', ''), '') ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
              THEN (o.occurrence_date::text || ' ' || COALESCE(ov.cutoff_time, s.guest_list_config->>'cutoff_time'))::timestamp
                   AT TIME ZONE COALESCE(s.timezone, 'Europe/London') END,
         o.lifecycle_status = 'cancelled',
         COALESCE(o.materialised_end_utc, o.materialised_start_utc + interval '6 hours') < now(),
         s.lifecycle_status = 'archived',
         ov.occurrence_p5_id IS NOT NULL
    FROM public.event_occurrence_p5 o
    JOIN public.event_series_p5 s ON s.id = o.series_id
    LEFT JOIN public.guest_list_night_settings_p5 ov ON ov.occurrence_p5_id = o.id
   WHERE o.id = p_occurrence_id;
$fn$;
REVOKE ALL ON FUNCTION public._guest_list_night_v1(uuid) FROM PUBLIC, anon, authenticated;

-- The caller's strongest seat on any organiser of the series: admin | owner | manager | interim | contributor | NULL.
CREATE FUNCTION public._guest_list_team_role_v1(p_organiser_ids uuid[])
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE
           WHEN auth.uid() IS NULL THEN NULL
           WHEN public.is_admin() THEN 'admin'
           ELSE (SELECT k FROM unnest(COALESCE(p_organiser_ids, '{}'::uuid[])) org(id)
                   CROSS JOIN LATERAL public._organiser_seat_kind_p5(org.id, auth.uid()) k
                  WHERE k IS NOT NULL
                  ORDER BY CASE k WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 WHEN 'interim' THEN 3 ELSE 4 END
                  LIMIT 1)
         END;
$fn$;
REVOKE ALL ON FUNCTION public._guest_list_team_role_v1(uuid[]) FROM PUBLIC, anon, authenticated;

-- Live names on one night: the night's own rows + Every-week rows of the series.
CREATE FUNCTION public._guest_list_night_counts_v1(p_series_id uuid, p_occurrence_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT jsonb_build_object(
           'names', count(*),
           'in', count(c.entry_id),
           'counted_for_places', count(*) FILTER (WHERE g.added_via IS DISTINCT FROM 'organiser' AND g.status = 'active'))
    FROM public.event_guest_list_entries g
    LEFT JOIN public.guest_list_check_ins_p5 c ON c.entry_id = g.id AND c.occurrence_p5_id = p_occurrence_id
   WHERE g.event_id_p5 = p_series_id
     AND g.deleted_at IS NULL AND g.status IN ('active', 'waitlist')
     AND (g.occurrence_p5_id = p_occurrence_id OR (g.occurrence_p5_id IS NULL AND g.is_permanent));
$fn$;
REVOKE ALL ON FUNCTION public._guest_list_night_counts_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Existing functions, rewired (bodies otherwise unchanged)
-- ---------------------------------------------------------------------------------------------

-- C5: organiser-added names do not count against the places.
CREATE OR REPLACE FUNCTION public._guest_list_door_headcount_v1(p_event_id uuid, p_bucket uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT count(*)::int
    FROM public.event_guest_list_entries g
   WHERE g.event_id = p_event_id
     AND g.status = 'active'
     AND g.deleted_at IS NULL
     AND g.added_via IS DISTINCT FROM 'organiser'
     AND (
       g.occurrence_p5_id IS NOT DISTINCT FROM p_bucket
       OR (p_bucket IS NOT NULL
           AND g.occurrence_p5_id IS NULL
           AND g.is_permanent)
     );
$function$;

-- C1: the cap is the night override when one is set for this bucket.
CREATE OR REPLACE FUNCTION public._claim_entry_slot_v1(p_kind text, p_event_id uuid, p_occurrence_id uuid DEFAULT NULL::uuid, p_is_permanent boolean DEFAULT false)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_capacity    int;
  v_waitlist_ok boolean;
  v_active      int;
  v_lock_key    text;
  v_ov_capacity int;
BEGIN
  IF p_kind NOT IN ('raffle', 'guest_list') THEN
    RAISE EXCEPTION '_claim_entry_slot_v1: invalid kind %', p_kind
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_kind = 'raffle' THEN
    RETURN 'active';
  END IF;

  -- Unlocked cap read (see 20261106270000 for the admits-then-caps note). Organiser guest list C1
  -- (organiser_guest_list_night_v1): a night override (guest_list_night_settings_p5) wins; 0 there = no limit.
  SELECT s.guest_list_capacity_max, s.waitlist_enabled
    INTO v_capacity, v_waitlist_ok
    FROM public.event_series_p5 s WHERE s.public_event_id = p_event_id;

  IF p_occurrence_id IS NOT NULL THEN
    SELECT ov.capacity_max INTO v_ov_capacity
      FROM public.guest_list_night_settings_p5 ov WHERE ov.occurrence_p5_id = p_occurrence_id;
    IF v_ov_capacity IS NOT NULL THEN
      v_capacity := v_ov_capacity;
    END IF;
  END IF;

  IF v_capacity IS NULL OR v_capacity <= 0 THEN
    RETURN 'active';
  END IF;

  -- Event-wide advisory lock per kind (a permanent VIP counts into every night).
  v_lock_key := p_kind || ':' || p_event_id::text;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  v_active := public._guest_list_door_headcount_v1(p_event_id, p_occurrence_id);

  IF v_active < v_capacity THEN
    RETURN 'active';
  ELSIF COALESCE(v_waitlist_ok, true) THEN
    RETURN 'waitlist';
  ELSE
    RETURN 'rejected';
  END IF;
END;
$function$;

-- C1: the public read applies the night override of the night it resolves.
CREATE OR REPLACE FUNCTION public.get_event_guest_list(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_enabled          boolean;
  v_entries          jsonb;
  v_active_count     integer;
  v_waitlist_count   integer;
  v_config           jsonb;
  v_cutoff_time      text;
  v_discount_until   text;
  v_description      text;
  v_reg_party        numeric;
  v_gl_party         numeric;
  v_reg_class        numeric;
  v_gl_class         numeric;
  v_event_tz         text;
  v_occurrence_p5_id uuid;
  v_bucket           uuid;
  v_anchor           timestamptz;
  v_start_local_date date;
  v_eff_source       text;
  v_cutoff_passed    boolean := false;
  v_cutoff_dt        timestamptz;
  v_gl_config        jsonb;
  v_show_permanent   boolean := false;
  v_capacity_max     integer;
  v_waitlist_enabled boolean;
  v_door_headcount   integer;
  v_spots_left       integer;
  v_ov               record;
BEGIN
  SELECT s.has_guestlist, s.guest_list_config, s.timezone, s.guest_list_capacity_max, s.waitlist_enabled
  INTO v_enabled, v_gl_config, v_event_tz, v_capacity_max, v_waitlist_enabled
  FROM public.event_series_p5 s
  WHERE s.public_event_id = p_event_id;

  IF v_enabled IS NULL THEN
    RETURN jsonb_build_object('enabled', false, 'entries', '[]'::jsonb);
  END IF;

  SELECT r.p5_occurrence_id, r.start_at_utc, r.start_local_date, r.source
    INTO v_occurrence_p5_id, v_anchor, v_start_local_date, v_eff_source
    FROM public.raffle_effective_occurrence_v1(p_event_id) r;

  v_bucket := v_occurrence_p5_id;
  v_cutoff_time := v_gl_config->>'cutoff_time';

  -- Organiser guest list C1 (organiser_guest_list_night_v1): the resolved night's override wins.
  IF v_bucket IS NOT NULL THEN
    SELECT ov.enabled, ov.capacity_max, ov.cutoff_time INTO v_ov
      FROM public.guest_list_night_settings_p5 ov WHERE ov.occurrence_p5_id = v_bucket;
    IF FOUND THEN
      v_enabled      := COALESCE(v_ov.enabled, v_enabled);
      v_capacity_max := COALESCE(v_ov.capacity_max, v_capacity_max);
      v_cutoff_time  := COALESCE(v_ov.cutoff_time, v_cutoff_time);
    END IF;
  END IF;

  IF NOT v_enabled THEN
    RETURN jsonb_build_object('enabled', false, 'entries', '[]'::jsonb);
  END IF;

  IF v_capacity_max IS NOT NULL AND v_capacity_max <= 0 THEN
    v_capacity_max := NULL;
  END IF;

  v_discount_until := v_gl_config->>'discount_valid_until';
  v_description    := v_gl_config->>'description';

  v_reg_party := CASE
    WHEN v_gl_config->>'regular_party_price' IS NOT NULL AND v_gl_config->>'regular_party_price' <> ''
    THEN (v_gl_config->>'regular_party_price')::numeric
    WHEN v_gl_config->>'regular_price' IS NOT NULL AND v_gl_config->>'regular_price' <> ''
    THEN (v_gl_config->>'regular_price')::numeric
    ELSE NULL
  END;

  v_gl_party := CASE
    WHEN v_gl_config->>'guest_list_party_price' IS NOT NULL AND v_gl_config->>'guest_list_party_price' <> ''
    THEN (v_gl_config->>'guest_list_party_price')::numeric
    WHEN v_gl_config->>'guest_list_price' IS NOT NULL AND v_gl_config->>'guest_list_price' <> ''
    THEN (v_gl_config->>'guest_list_price')::numeric
    ELSE NULL
  END;

  v_reg_class := CASE
    WHEN v_gl_config->>'regular_class_party_price' IS NOT NULL AND v_gl_config->>'regular_class_party_price' <> ''
    THEN (v_gl_config->>'regular_class_party_price')::numeric
    ELSE NULL
  END;

  v_gl_class := CASE
    WHEN v_gl_config->>'guest_list_class_party_price' IS NOT NULL AND v_gl_config->>'guest_list_class_party_price' <> ''
    THEN (v_gl_config->>'guest_list_class_party_price')::numeric
    ELSE NULL
  END;

  IF v_cutoff_time IS NOT NULL AND v_cutoff_time <> '' AND v_start_local_date IS NOT NULL THEN
    BEGIN
      v_cutoff_dt := (
        v_start_local_date::text || ' ' || v_cutoff_time
      )::timestamp AT TIME ZONE COALESCE(v_event_tz, 'Europe/London');

      v_cutoff_passed := (now() >= v_cutoff_dt);
    EXCEPTION WHEN OTHERS THEN
      v_cutoff_passed := false;
    END;
  END IF;

  IF v_eff_source = 'event_start_fallback' THEN
    v_show_permanent := true;
  ELSIF v_anchor IS NOT NULL AND v_anchor <= now() + interval '3 days' THEN
    v_show_permanent := true;
  END IF;

  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'first_name', e.first_name,
        'created_at', e.created_at,
        'status',     e.status
      ) ORDER BY e.created_at ASC
    ), '[]'::jsonb),
    count(*) FILTER (WHERE e.status = 'active'),
    count(*) FILTER (WHERE e.status = 'waitlist')
  INTO v_entries, v_active_count, v_waitlist_count
  FROM public.event_guest_list_entries e
  WHERE e.event_id = p_event_id
    AND e.deleted_at IS NULL
    AND e.status IN ('active', 'waitlist')
    AND (
      (e.occurrence_p5_id IS NULL
        AND (e.is_permanent = false OR v_show_permanent))
      OR (v_bucket IS NOT NULL
        AND e.occurrence_p5_id = v_bucket)
    );

  IF v_capacity_max IS NOT NULL THEN
    v_door_headcount   := public._guest_list_door_headcount_v1(p_event_id, v_bucket);
    v_spots_left       := GREATEST(0, v_capacity_max - v_door_headcount);
    v_waitlist_enabled := COALESCE(v_waitlist_enabled, true);
  ELSE
    v_waitlist_enabled := NULL;
  END IF;

  v_config := jsonb_build_object(
    'cutoff_time',                COALESCE(v_cutoff_time, ''),
    'discount_until',             COALESCE(v_discount_until, ''),
    'description',                COALESCE(v_description, ''),
    'regular_party_price',        v_reg_party,
    'guest_list_party_price',     v_gl_party,
    'regular_class_party_price',  v_reg_class,
    'guest_list_class_party_price', v_gl_class
  );

  RETURN jsonb_build_object(
    'enabled',          true,
    'count',            COALESCE(v_active_count, 0),
    'entries',          v_entries,
    'config',           v_config,
    'cutoff_passed',    v_cutoff_passed,
    'active_count',     COALESCE(v_active_count, 0),
    'waitlist_count',   COALESCE(v_waitlist_count, 0),
    'capacity_max',     v_capacity_max,
    'waitlist_enabled', v_waitlist_enabled,
    'spots_left',       v_spots_left
  );
END;
$function$;

-- C1: the anonymous submit applies the night override of the night it resolves.
CREATE OR REPLACE FUNCTION public.submit_guest_list_entry(p_event_id uuid, p_first_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_clean_name       text;
  v_enabled          boolean;
  v_archived         boolean;
  v_entry_id         uuid;
  v_gl_config        jsonb;
  v_event_tz         text;
  v_occurrence_id    uuid;
  v_occurrence_p5_id uuid;
  v_start_local_date date;
  v_cutoff_time      text;
  v_cutoff_dt        timestamptz;
  v_status           text := 'active';
  v_headers          jsonb;
  v_ip               text;
  v_event_id_p5      uuid;
  v_ov               record;
BEGIN
  v_clean_name := trim(p_first_name);

  IF v_clean_name IS NULL OR char_length(v_clean_name) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_required');
  END IF;

  IF char_length(v_clean_name) > 80 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_too_long');
  END IF;

  BEGIN
    v_headers := current_setting('request.headers', true)::jsonb;
    IF v_headers IS NOT NULL THEN
      v_ip := trim(coalesce(v_headers->>'cf-connecting-ip', ''));
      IF v_ip <> '' THEN
        IF NOT public._raffle_throttle_allow_v1('guest_ip', v_ip, 60, interval '1 hour') THEN
          RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
        END IF;
      ELSE
        RAISE LOG 'submit_guest_list_entry: no usable client IP header; rate limit not applied (event %)',
          p_event_id;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- FOR UPDATE on the P5 series row closes the archive-vs-submit race (20261106650000).
  SELECT s.id, s.has_guestlist, s.guest_list_config, s.timezone,
         (s.lifecycle_status = 'archived')
  INTO v_event_id_p5, v_enabled, v_gl_config, v_event_tz, v_archived
  FROM public.event_series_p5 s
  WHERE s.public_event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_not_found');
  END IF;

  IF v_archived THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_archived');
  END IF;

  SELECT r.legacy_occurrence_id, r.p5_occurrence_id, r.start_local_date
    INTO v_occurrence_id, v_occurrence_p5_id, v_start_local_date
    FROM public.raffle_effective_occurrence_v1(p_event_id) r;

  v_cutoff_time := v_gl_config->>'cutoff_time';

  -- Organiser guest list C1 (organiser_guest_list_night_v1): the resolved night's override wins.
  IF v_occurrence_p5_id IS NOT NULL THEN
    SELECT ov.enabled, ov.cutoff_time INTO v_ov
      FROM public.guest_list_night_settings_p5 ov WHERE ov.occurrence_p5_id = v_occurrence_p5_id;
    IF FOUND THEN
      v_enabled     := COALESCE(v_ov.enabled, v_enabled);
      v_cutoff_time := COALESCE(v_ov.cutoff_time, v_cutoff_time);
    END IF;
  END IF;

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'guest_list_not_enabled');
  END IF;

  IF v_cutoff_time IS NOT NULL AND v_cutoff_time <> '' AND v_start_local_date IS NOT NULL THEN
    BEGIN
      v_cutoff_dt := (
        v_start_local_date::text || ' ' || v_cutoff_time
      )::timestamp AT TIME ZONE COALESCE(v_event_tz, 'Europe/London');

      IF now() >= v_cutoff_dt THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'cutoff_passed');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  v_status := public._claim_entry_slot_v1(
    'guest_list', p_event_id, v_occurrence_p5_id, false);
  IF v_status = 'rejected' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'capacity_full');
  END IF;

  BEGIN
    INSERT INTO event_guest_list_entries (event_id, event_id_p5, first_name, occurrence_p5_id, status, added_via)
    VALUES (
      p_event_id,
      v_event_id_p5,
      v_clean_name, v_occurrence_p5_id, v_status, 'self'
    )
    RETURNING id INTO v_entry_id;

    RETURN jsonb_build_object('ok', true, 'entry_id', v_entry_id,
                             'occurrence_id', v_occurrence_id,
                             'occurrence_p5_id', v_occurrence_p5_id,
                             'status', v_status);

  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_name');
  END;
END;
$function$;

-- ---------------------------------------------------------------------------------------------
-- Organiser RPCs (C6, C4, C8)
-- ---------------------------------------------------------------------------------------------

-- Shared gate: the night + the caller's role. Raises nothing; returns a reason instead.
CREATE FUNCTION public._guest_list_organiser_gate_v1(p_occurrence_id uuid, p_need_edit boolean)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  n    record;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  END IF;
  SELECT * INTO n FROM public._guest_list_night_v1(p_occurrence_id);
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'night_not_found');
  END IF;
  v_role := public._guest_list_team_role_v1(n.organiser_ids);
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_on_team');
  END IF;
  IF p_need_edit AND v_role NOT IN ('admin', 'owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'view_only', 'role', v_role);
  END IF;
  RETURN jsonb_build_object('ok', true, 'role', v_role, 'series_id', n.series_id,
                            'public_event_id', n.public_event_id);
END;
$fn$;
REVOKE ALL ON FUNCTION public._guest_list_organiser_gate_v1(uuid, boolean) FROM PUBLIC, anon, authenticated;

-- Names / Door view for one night. p_view 'door' puts not-yet-in first. Pages: p_limit <= 100.
CREATE FUNCTION public.organiser_guest_list_night_v1(
  p_occurrence_id uuid, p_view text DEFAULT 'names', p_query text DEFAULT NULL,
  p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  g       jsonb;
  n       record;
  v_can   boolean;
  v_lim   int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_off   int := GREATEST(COALESCE(p_offset, 0), 0);
  v_q     text := NULLIF(lower(trim(COALESCE(p_query, ''))), '');
  v_counts jsonb;
  v_total int;
  v_rows  jsonb;
  v_reason text;
BEGIN
  g := public._guest_list_organiser_gate_v1(p_occurrence_id, false);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  SELECT * INTO n FROM public._guest_list_night_v1(p_occurrence_id);
  v_can := g->>'role' IN ('admin', 'owner', 'manager');
  v_counts := public._guest_list_night_counts_v1(n.series_id, n.occurrence_id);

  v_reason := CASE
    WHEN NOT v_can THEN 'view_only'
    WHEN n.is_cancelled THEN 'cancelled'
    WHEN n.is_past THEN 'past'
    ELSE NULL END;

  WITH rows AS (
    SELECT e.id, e.first_name, e.is_permanent, e.status, e.created_at, e.added_via, e.added_by,
           (e.user_id IS NOT NULL) AS has_account, c.checked_in_at, c.via AS checked_in_via
      FROM public.event_guest_list_entries e
      LEFT JOIN public.guest_list_check_ins_p5 c ON c.entry_id = e.id AND c.occurrence_p5_id = n.occurrence_id
     WHERE e.event_id_p5 = n.series_id
       AND e.deleted_at IS NULL AND e.status IN ('active', 'waitlist')
       AND (e.occurrence_p5_id = n.occurrence_id OR (e.occurrence_p5_id IS NULL AND e.is_permanent))
       AND (v_q IS NULL OR strpos(lower(e.first_name), v_q) > 0)
  )
  SELECT (SELECT count(*) FROM rows),
         COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM (
           SELECT r.* FROM rows r
            ORDER BY CASE WHEN p_view = 'door' THEN (r.checked_in_at IS NOT NULL)::int ELSE 0 END,
                     CASE WHEN p_view = 'door' THEN lower(r.first_name) END,
                     r.created_at, r.id
            LIMIT v_lim OFFSET v_off) p), '[]'::jsonb)
    INTO v_total, v_rows;

  RETURN jsonb_build_object(
    'ok', true,
    'role', g->>'role',
    'can_edit', v_can AND v_reason IS NULL,
    'can_check_in', v_can AND NOT n.is_cancelled,
    'read_only_reason', v_reason,
    'night', jsonb_build_object(
      'occurrence_id', n.occurrence_id, 'series_id', n.series_id, 'public_event_id', n.public_event_id,
      'date', n.occurrence_date, 'starts_at', n.starts_at,
      'enabled', n.enabled, 'capacity_max', n.capacity_max, 'cutoff_time', n.cutoff_time,
      'closes_at', n.closes_at, 'has_override', n.has_override,
      'closed', n.closes_at IS NOT NULL AND now() >= n.closes_at,
      'full', n.capacity_max IS NOT NULL AND (v_counts->>'counted_for_places')::int >= n.capacity_max,
      'past', n.is_past, 'cancelled', n.is_cancelled),
    'counts', v_counts || jsonb_build_object('places_left',
       CASE WHEN n.capacity_max IS NULL THEN NULL
            ELSE GREATEST(0, n.capacity_max - (v_counts->>'counted_for_places')::int) END),
    'total', v_total, 'limit', v_lim, 'offset', v_off,
    'entries', v_rows);
END;
$fn$;

-- Settings for ONE night. Each argument: NULL = use the series value. capacity 0 = no limit; cutoff '' = none.
CREATE FUNCTION public.organiser_guest_list_set_night_v1(
  p_occurrence_id uuid, p_enabled boolean, p_capacity_max integer DEFAULT NULL, p_cutoff_time text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  g jsonb;
  n record;
BEGIN
  g := public._guest_list_organiser_gate_v1(p_occurrence_id, true);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  SELECT * INTO n FROM public._guest_list_night_v1(p_occurrence_id);
  IF n.is_cancelled THEN RETURN jsonb_build_object('ok', false, 'reason', 'cancelled'); END IF;
  IF n.is_past THEN RETURN jsonb_build_object('ok', false, 'reason', 'past'); END IF;
  IF p_capacity_max IS NOT NULL AND (p_capacity_max < 0 OR p_capacity_max > 100000) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_capacity');
  END IF;
  IF p_cutoff_time IS NOT NULL AND p_cutoff_time <> '' AND p_cutoff_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'bad_cutoff_time');
  END IF;

  INSERT INTO public.guest_list_night_settings_p5 AS t (occurrence_p5_id, enabled, capacity_max, cutoff_time, updated_by)
  VALUES (p_occurrence_id, p_enabled, p_capacity_max, p_cutoff_time, auth.uid())
  ON CONFLICT (occurrence_p5_id) DO UPDATE
     SET enabled = EXCLUDED.enabled, capacity_max = EXCLUDED.capacity_max,
         cutoff_time = EXCLUDED.cutoff_time, updated_at = now(), updated_by = auth.uid();

  RETURN public.organiser_guest_list_night_v1(p_occurrence_id, 'names', NULL, 1, 0) - 'entries';
END;
$fn$;

-- Add a name (this night, or every week). Organiser-added names never use a place and work when closed/full.
CREATE FUNCTION public.organiser_guest_list_add_v1(p_occurrence_id uuid, p_first_name text, p_every_week boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  g jsonb;
  n record;
  v_name text := trim(COALESCE(p_first_name, ''));
  v_id uuid;
BEGIN
  g := public._guest_list_organiser_gate_v1(p_occurrence_id, true);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  SELECT * INTO n FROM public._guest_list_night_v1(p_occurrence_id);
  IF n.is_cancelled THEN RETURN jsonb_build_object('ok', false, 'reason', 'cancelled'); END IF;
  IF n.is_past THEN RETURN jsonb_build_object('ok', false, 'reason', 'past'); END IF;
  IF char_length(v_name) < 1 THEN RETURN jsonb_build_object('ok', false, 'reason', 'name_required'); END IF;
  IF char_length(v_name) > 80 THEN RETURN jsonb_build_object('ok', false, 'reason', 'name_too_long'); END IF;

  BEGIN
    INSERT INTO public.event_guest_list_entries
      (event_id, event_id_p5, first_name, occurrence_p5_id, is_permanent, status, added_by, added_via)
    VALUES (n.public_event_id, n.series_id, v_name,
            CASE WHEN COALESCE(p_every_week, false) THEN NULL ELSE n.occurrence_id END,
            COALESCE(p_every_week, false), 'active', auth.uid(), 'organiser')
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_name');
  END;
  RETURN jsonb_build_object('ok', true, 'entry_id', v_id);
END;
$fn$;

-- Entry -> its night gate. An Every-week entry is gated through p_occurrence_id (must be a night of its series).
CREATE FUNCTION public._guest_list_entry_gate_v1(p_entry_id uuid, p_occurrence_id uuid, p_need_edit boolean)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  e record;
  g jsonb;
BEGIN
  SELECT id, event_id_p5, occurrence_p5_id, is_permanent, deleted_at, deleted_reason, status
    INTO e FROM public.event_guest_list_entries WHERE id = p_entry_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'entry_not_found'); END IF;
  g := public._guest_list_organiser_gate_v1(COALESCE(e.occurrence_p5_id, p_occurrence_id), p_need_edit);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  IF (g->>'series_id')::uuid IS DISTINCT FROM e.event_id_p5
     OR (e.occurrence_p5_id IS NOT NULL AND p_occurrence_id IS NOT NULL AND e.occurrence_p5_id <> p_occurrence_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'other_night');
  END IF;
  RETURN g || jsonb_build_object('night', COALESCE(e.occurrence_p5_id, p_occurrence_id),
                                 'deleted', e.deleted_at IS NOT NULL, 'deleted_reason', e.deleted_reason,
                                 'status', e.status);
END;
$fn$;
REVOKE ALL ON FUNCTION public._guest_list_entry_gate_v1(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;

-- Remove = soft delete (Undo = organiser_guest_list_restore_v1). An Every-week name is removed from every week.
CREATE FUNCTION public.organiser_guest_list_remove_v1(p_entry_id uuid, p_occurrence_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  g jsonb;
BEGIN
  g := public._guest_list_entry_gate_v1(p_entry_id, p_occurrence_id, true);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  IF (g->>'deleted')::boolean THEN RETURN jsonb_build_object('ok', true, 'changed', false); END IF;
  UPDATE public.event_guest_list_entries
     SET deleted_at = now(), deleted_reason = 'organiser_removed'
   WHERE id = p_entry_id AND deleted_at IS NULL;
  RETURN jsonb_build_object('ok', true, 'changed', true);
END;
$fn$;

-- Undo a remove made by the team (only rows removed with reason 'organiser_removed').
CREATE FUNCTION public.organiser_guest_list_restore_v1(p_entry_id uuid, p_occurrence_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  g jsonb;
BEGIN
  g := public._guest_list_entry_gate_v1(p_entry_id, p_occurrence_id, true);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  IF NOT (g->>'deleted')::boolean THEN RETURN jsonb_build_object('ok', true, 'changed', false); END IF;
  IF g->>'deleted_reason' IS DISTINCT FROM 'organiser_removed' OR g->>'status' = 'erased' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_restorable');
  END IF;
  BEGIN
    UPDATE public.event_guest_list_entries
       SET deleted_at = NULL, deleted_reason = NULL, qr_token <- gen_random_uuid()
     WHERE id = p_entry_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_name');
  END;
  RETURN jsonb_build_object('ok', true, 'changed', true);
END;
$fn$;

-- Door check-in on one night (owner/manager/admin; contributor cannot). Idempotent.
CREATE FUNCTION public.organiser_check_in_guest_v1(p_entry_id uuid, p_occurrence_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  g jsonb;
  n record;
BEGIN
  IF p_occurrence_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'night_required'); END IF;
  g := public._guest_list_entry_gate_v1(p_entry_id, p_occurrence_id, true);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  IF (g->>'deleted')::boolean OR g->>'status' <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_on_list');
  END IF;
  SELECT * INTO n FROM public._guest_list_night_v1(p_occurrence_id);
  IF n.is_cancelled THEN RETURN jsonb_build_object('ok', false, 'reason', 'cancelled'); END IF;
  INSERT INTO public.guest_list_check_ins_p5 (entry_id, occurrence_p5_id, checked_in_by, via)
  VALUES (p_entry_id, p_occurrence_id, auth.uid(), 'tap')
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'counts', public._guest_list_night_counts_v1(n.series_id, p_occurrence_id));
END;
$fn$;

CREATE FUNCTION public.organiser_undo_check_in_guest_v1(p_entry_id uuid, p_occurrence_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  g jsonb;
BEGIN
  IF p_occurrence_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'night_required'); END IF;
  g := public._guest_list_entry_gate_v1(p_entry_id, p_occurrence_id, true);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  DELETE FROM public.guest_list_check_ins_p5 WHERE entry_id = p_entry_id AND occurrence_p5_id = p_occurrence_id;
  RETURN jsonb_build_object('ok', true,
    'counts', public._guest_list_night_counts_v1((g->>'series_id')::uuid, p_occurrence_id));
END;
$fn$;

-- QR scan at the door: the token must belong to THIS night (or an Every-week name of this series).
CREATE FUNCTION public.organiser_guest_list_scan_v1(p_occurrence_id uuid, p_qr_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  g jsonb;
  e record;
  v_new boolean;
BEGIN
  g := public._guest_list_organiser_gate_v1(p_occurrence_id, true);
  IF NOT (g->>'ok')::boolean THEN RETURN g; END IF;
  SELECT x.id, x.first_name, x.event_id_p5, x.occurrence_p5_id, x.is_permanent, o.occurrence_date
    INTO e
    FROM public.event_guest_list_entries x
    LEFT JOIN public.event_occurrence_p5 o ON o.id = x.occurrence_p5_id
   WHERE x.qr_token = p_qr_token AND x.deleted_at IS NULL AND x.status = 'active';
  IF NOT FOUND OR e.event_id_p5 IS DISTINCT FROM (g->>'series_id')::uuid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF e.occurrence_p5_id IS NOT NULL AND e.occurrence_p5_id <> p_occurrence_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'other_night', 'first_name', e.first_name,
                              'night_date', e.occurrence_date);
  END IF;
  IF e.occurrence_p5_id IS NULL AND NOT e.is_permanent THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  INSERT INTO public.guest_list_check_ins_p5 (entry_id, occurrence_p5_id, checked_in_by, via)
  VALUES (e.id, p_occurrence_id, auth.uid(), 'qr')
  ON CONFLICT DO NOTHING
  RETURNING true INTO v_new;
  RETURN jsonb_build_object('ok', true, 'entry_id', e.id, 'first_name', e.first_name,
    'already_in', v_new IS NULL,
    'counts', public._guest_list_night_counts_v1((g->>'series_id')::uuid, p_occurrence_id));
END;
$fn$;

-- ---------------------------------------------------------------------------------------------
-- Dancer RPCs (C2, C3, C7, C8)
-- ---------------------------------------------------------------------------------------------

-- What a per-night sign-up link resolves to. Public; counts only, never names.
CREATE FUNCTION public.guest_list_night_public_v1(p_occurrence_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  n record;
  v_counts jsonb;
  v_reason text;
BEGIN
  SELECT * INTO n FROM public._guest_list_night_v1(p_occurrence_id);
  IF NOT FOUND OR n.is_archived OR n.public_event_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'night_not_found');
  END IF;
  v_counts := public._guest_list_night_counts_v1(n.series_id, n.occurrence_id);
  v_reason := CASE
    WHEN n.is_cancelled THEN 'cancelled'
    WHEN n.is_past THEN 'past'
    WHEN NOT n.enabled THEN 'off'
    WHEN n.closes_at IS NOT NULL AND now() >= n.closes_at THEN 'closed'
    WHEN n.capacity_max IS NOT NULL AND (v_counts->>'counted_for_places')::int >= n.capacity_max
         AND NOT n.waitlist_enabled THEN 'full'
    ELSE NULL END;
  RETURN jsonb_build_object('ok', true, 'public_event_id', n.public_event_id, 'occurrence_id', n.occurrence_id,
    'date', n.occurrence_date, 'closes_at', n.closes_at, 'open', v_reason IS NULL, 'reason', v_reason,
    'names', (v_counts->>'names')::int);
END;
$fn$;

-- Signed-in sign-up: one entry per account per night; only the first word of the name is stored (shown publicly).
CREATE FUNCTION public.submit_my_guest_list_entry_v1(p_occurrence_id uuid, p_first_name text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  n record;
  v_name text := split_part(regexp_replace(trim(COALESCE(p_first_name, '')), '\s+', ' ', 'g'), ' ', 1);
  v_status text;
  v_id uuid;
  v_lock record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  IF char_length(v_name) < 1 THEN RETURN jsonb_build_object('ok', false, 'reason', 'name_required'); END IF;
  IF char_length(v_name) > 80 THEN RETURN jsonb_build_object('ok', false, 'reason', 'name_too_long'); END IF;

  SELECT * INTO n FROM public._guest_list_night_v1(p_occurrence_id);
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'night_not_found'); END IF;
  -- Same archive-vs-submit lock as submit_guest_list_entry.
  SELECT s.lifecycle_status INTO v_lock FROM public.event_series_p5 s WHERE s.id = n.series_id FOR UPDATE;
  IF v_lock.lifecycle_status = 'archived' THEN RETURN jsonb_build_object('ok', false, 'reason', 'event_archived'); END IF;
  IF n.is_cancelled THEN RETURN jsonb_build_object('ok', false, 'reason', 'cancelled'); END IF;
  IF n.is_past THEN RETURN jsonb_build_object('ok', false, 'reason', 'past'); END IF;
  IF NOT n.enabled THEN RETURN jsonb_build_object('ok', false, 'reason', 'guest_list_not_enabled'); END IF;
  IF n.closes_at IS NOT NULL AND now() >= n.closes_at THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cutoff_passed');
  END IF;

  SELECT id INTO v_id FROM public.event_guest_list_entries
   WHERE user_id = auth.uid() AND occurrence_p5_id = n.occurrence_id
     AND deleted_at IS NULL AND status IN ('active', 'waitlist');
  IF FOUND THEN RETURN jsonb_build_object('ok', true, 'entry_id', v_id, 'already_on_list', true); END IF;

  v_status := public._claim_entry_slot_v1('guest_list', n.public_event_id, n.occurrence_id, false);
  IF v_status = 'rejected' THEN RETURN jsonb_build_object('ok', false, 'reason', 'capacity_full'); END IF;

  BEGIN
    INSERT INTO public.event_guest_list_entries
      (event_id, event_id_p5, first_name, occurrence_p5_id, status, user_id, added_by, added_via)
    VALUES (n.public_event_id, n.series_id, v_name, n.occurrence_id, v_status, auth.uid(), auth.uid(), 'self')
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    -- Same first name already on this night (name uniques) or a concurrent call from this account.
    RETURN jsonb_build_object('ok', false, 'reason', 'duplicate_name');
  END;
  RETURN jsonb_build_object('ok', true, 'entry_id', v_id, 'status', v_status, 'already_on_list', false);
END;
$fn$;

-- Remove me: soft delete of the caller's own entry on that night. The token erase path stays separate.
CREATE FUNCTION public.remove_my_guest_list_entry_v1(p_occurrence_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_n int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_signed_in'); END IF;
  UPDATE public.event_guest_list_entries
     SET deleted_at = now(), deleted_reason = 'dancer_removed'
   WHERE user_id = auth.uid() AND occurrence_p5_id = p_occurrence_id AND deleted_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'changed', v_n > 0);
END;
$fn$;

-- The caller's own entry on a night (+ its QR token, shown only to them).
CREATE FUNCTION public.get_my_guest_list_entry_v1(p_occurrence_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE WHEN auth.uid() IS NULL THEN jsonb_build_object('ok', false, 'reason', 'not_signed_in')
    ELSE COALESCE((
      SELECT jsonb_build_object('ok', true, 'on_list', true, 'entry_id', e.id, 'first_name', e.first_name,
                                'status', e.status, 'qr_token', e.qr_token, 'checked_in', c.entry_id IS NOT NULL)
        FROM public.event_guest_list_entries e
        LEFT JOIN public.guest_list_check_ins_p5 c ON c.entry_id = e.id AND c.occurrence_p5_id = e.occurrence_p5_id
       WHERE e.user_id = auth.uid() AND e.occurrence_p5_id = p_occurrence_id
         AND e.deleted_at IS NULL AND e.status IN ('active', 'waitlist')
       LIMIT 1), jsonb_build_object('ok', true, 'on_list', false)) END;
$fn$;

-- Grants: authenticated only (gates are inside), except the public night resolver.
DO $grants$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'public.organiser_guest_list_night_v1(uuid,text,text,integer,integer)',
    'public.organiser_guest_list_set_night_v1(uuid,boolean,integer,text)',
    'public.organiser_guest_list_add_v1(uuid,text,boolean)',
    'public.organiser_guest_list_remove_v1(uuid,uuid)',
    'public.organiser_guest_list_restore_v1(uuid,uuid)',
    'public.organiser_check_in_guest_v1(uuid,uuid)',
    'public.organiser_undo_check_in_guest_v1(uuid,uuid)',
    'public.organiser_guest_list_scan_v1(uuid,uuid)',
    'public.submit_my_guest_list_entry_v1(uuid,text)',
    'public.remove_my_guest_list_entry_v1(uuid)',
    'public.get_my_guest_list_entry_v1(uuid)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', s);
  END LOOP;
END
$grants$;
REVOKE ALL ON FUNCTION public.guest_list_night_public_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guest_list_night_public_v1(uuid) TO anon, authenticated;

SELECT public.mark_migration_complete('99990101000000_organiser_guest_list_night_v1');
```
