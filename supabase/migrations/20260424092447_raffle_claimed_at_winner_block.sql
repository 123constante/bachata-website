-- =============================================================================
-- Raffle Phase 1 — Commit 7: claimed_at column + winner-block eligibility
-- -----------------------------------------------------------------------------
-- Three changes in one migration.
--
-- 1. Add claimed_at timestamptz column to event_raffle_draws. Nullable, no
--    default — every draw inserted from now on explicitly writes its value
--    from admin_draw_raffle_winner_v1; legacy rows (none at Phase 1 so far)
--    stay NULL.
--
-- 2. admin_draw_raffle_winner_v1 patch — the INSERT now writes claimed_at
--    alongside drawn_at using now(). Both columns receive the same timestamp
--    at Phase 1 ("draw == claim" model). Phase 2 may separate the two
--    semantics (e.g. a "Mark as Claimed" admin button), at which point the
--    two timestamps diverge.
--
-- 3. submit_raffle_entry patch (Option Z) — a new winner-block eligibility
--    check is inserted BEFORE the organiser-wide duplicate check. It blocks
--    a phone from re-entering an event where it's already the currently-
--    active claimed winner. Filters:
--      - erd.is_active = true        (demoted re-draw rows do not block;
--                                     no-show → redraw flow works cleanly)
--      - erd.claimed_at IS NOT NULL  (belt-and-braces for Phase 1; load-bearing
--                                     the moment Phase 2 splits draw vs claim)
--    No ere.deleted_at filter — winning a prize is a permanent fact about
--    the phone × event pair. Soft-deleting the entry (e.g. GDPR retention)
--    does not un-win the prize; event_raffle_draws is the audit-integrity
--    source, independent of entries table state.
--
--    New reason code: 'already_won_this_event'. Reuses existing v_already
--    local — no new DECLARE entry. The block returns immediately on match,
--    so the organiser-wide check below reassigns v_already cleanly.
--
-- Both function bodies are copied verbatim from pg_get_functiondef as read
-- from live pg_proc on 2026-04-24. Only the three approved diffs differ
-- from the source. $function$ delimiters preserved.
--
-- Not touched in this commit:
--   - sync_raffle_flag, get_event_raffle, admin_list_raffle_entries_v1
--   - admin_save_event_v2_impl, admin_get_event_snapshot_v2 (Commit 6)
--   - submit_guest_list_entry, get_event_guest_list, sync_guestlist_flag
--   - get_event_page_snapshot_v2, record_event_view_v1
-- =============================================================================

BEGIN;

ALTER TABLE public.event_raffle_draws
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_draw_raffle_winner_v1(p_event_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor_id      uuid;
  v_existing_draw record;
  v_snapshot      jsonb;
  v_entry_count   int;
  v_winner_id     uuid;
  v_new_draw      record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_actor_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_not_found');
  END IF;

  SELECT * INTO v_existing_draw
    FROM event_raffle_draws
   WHERE event_id = p_event_id AND is_active = true
   LIMIT 1;

  IF v_existing_draw.id IS NOT NULL THEN
    IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'reason', 'redraw_requires_reason',
        'existing_draw_id', v_existing_draw.id
      );
    END IF;
  END IF;

  -- Snapshot live entries (excludes soft-deleted) into jsonb array.
  -- Same-transaction MVCC: any concurrent insert either commits before
  -- this read (included) or after (excluded). Snapshot and winner pick
  -- below see the same row set.
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',          ere.id,
        'first_name',  ere.first_name,
        'phone_e164',  ere.phone_e164,
        'created_at',  ere.created_at
      ) ORDER BY ere.created_at
    ), '[]'::jsonb),
    COUNT(*)
    INTO v_snapshot, v_entry_count
    FROM event_raffle_entries ere
   WHERE ere.event_id = p_event_id
     AND ere.deleted_at IS NULL;

  IF v_entry_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_entries');
  END IF;

  -- Pick winner. ORDER BY random() LIMIT 1 — adequate for Phase 1 volumes.
  -- Audit integrity comes from the snapshot + chain, not RNG strength.
  SELECT id INTO v_winner_id
    FROM event_raffle_entries
   WHERE event_id = p_event_id AND deleted_at IS NULL
   ORDER BY random()
   LIMIT 1;

  -- Demote existing active draw before insert. The partial unique index
  -- uq_event_raffle_draws_one_active_per_event enforces at-most-one
  -- is_active=true per event_id. UPDATE-then-INSERT order is load-bearing:
  -- reordering would fire unique_violation before FK evaluation.
  IF v_existing_draw.id IS NOT NULL THEN
    UPDATE event_raffle_draws
       SET is_active = false
     WHERE id = v_existing_draw.id;
  END IF;

  INSERT INTO event_raffle_draws (
    event_id,
    prior_draw_id,
    is_active,
    drawn_at,
    winner_entry_id,
    entries_snapshot,
    drawn_by,
    claimed_at
  ) VALUES (
    p_event_id,
    v_existing_draw.id,
    true,
    now(),
    v_winner_id,
    v_snapshot,
    v_actor_id,
    now()
  )
  RETURNING * INTO v_new_draw;

  RETURN jsonb_build_object(
    'ok',                true,
    'draw_id',           v_new_draw.id,
    'winner_entry_id',   v_winner_id,
    'entry_count',       v_entry_count,
    'is_redraw',         v_existing_draw.id IS NOT NULL,
    'prior_draw_id',     v_existing_draw.id,
    'reason',            p_reason,
    'drawn_by',          v_actor_id,
    'drawn_at',          v_new_draw.drawn_at
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_raffle_entry(p_event_id uuid, p_first_name text, p_phone_e164 text, p_consent_version text, p_honeypot text DEFAULT NULL::text, p_session_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_clean_name    text;
  v_clean_phone   text;
  v_enabled       boolean;
  v_meta          jsonb;
  v_event_start   timestamptz;
  v_event_tz      text;
  v_cutoff_time   text;
  v_cutoff_dt     timestamptz;
  v_entry_id      uuid;
  v_organiser_ids uuid[];
  v_already       boolean;
BEGIN
  -- Honeypot: bots fill hidden fields. Return fake-success shape so they
  -- have nothing to learn from. No DB row, no rate-limit signal, no clue.
  IF p_honeypot IS NOT NULL AND length(trim(p_honeypot)) > 0 THEN
    RETURN jsonb_build_object('ok', true, 'entry_id', gen_random_uuid());
  END IF;

  v_clean_name  := trim(p_first_name);
  v_clean_phone := trim(p_phone_e164);

  -- Name validation (mirrors guest list: 1-80 chars)
  IF v_clean_name IS NULL OR char_length(v_clean_name) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_required');
  END IF;
  IF char_length(v_clean_name) > 80 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_too_long');
  END IF;

  -- Phone validation (E.164: + then 8-15 digits, first digit 1-9)
  IF v_clean_phone IS NULL OR v_clean_phone !~ '^\+[1-9][0-9]{7,14}$' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'phone_invalid');
  END IF;

  -- Consent capture required
  IF p_consent_version IS NULL OR length(trim(p_consent_version)) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'consent_required');
  END IF;

  -- Event lookup + raffle-enabled check
  SELECT has_raffle, meta_data, start_time, timezone
    INTO v_enabled, v_meta, v_event_start, v_event_tz
    FROM events
   WHERE id = p_event_id;

  IF v_enabled IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'event_not_found');
  END IF;

  IF NOT v_enabled THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'raffle_not_enabled');
  END IF;

  -- Cutoff enforcement (mirror guest list: fail-open on parse error so a
  -- malformed cutoff string never blocks legitimate entries)
  v_cutoff_time := v_meta->'raffle'->>'cutoff_time';
  IF v_cutoff_time IS NOT NULL AND v_cutoff_time <> '' AND v_event_start IS NOT NULL THEN
    BEGIN
      v_cutoff_dt := (
        (v_event_start AT TIME ZONE COALESCE(v_event_tz, 'Europe/London'))::date
        || ' ' || v_cutoff_time
      )::timestamp AT TIME ZONE COALESCE(v_event_tz, 'Europe/London');
      IF now() >= v_cutoff_dt THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'cutoff_passed');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Eligibility check: phone has already won (claimed) on this specific event.
  -- The is_active = true filter ensures that demoted re-draw rows do NOT block
  -- future entries — only the currently-active claimed winner is blocked.
  -- Handles the no-show-then-redraw case cleanly: the no-show's draw gets
  -- demoted to is_active = false on re-draw and no longer blocks them.
  SELECT EXISTS (
    SELECT 1
      FROM event_raffle_draws erd
      JOIN event_raffle_entries ere ON ere.id = erd.winner_entry_id
     WHERE erd.event_id = p_event_id
       AND erd.is_active = true
       AND erd.claimed_at IS NOT NULL
       AND ere.phone_e164 = v_clean_phone
  ) INTO v_already;

  IF v_already THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_won_this_event');
  END IF;

  -- Eligibility (Phase 1 rule): phone has never entered any raffle at any
  -- event owned by any organiser of this event. The check joins through
  -- event_entities to find all events owned by the same organiser entity.
  -- TODO(future): extend rule to also check event_attendance by phone when
  -- phone is captured on attendance. The current schema does not store phone
  -- on event_attendance, so attendance-based eligibility is deferred.
  SELECT array_agg(DISTINCT ee.entity_id)
    INTO v_organiser_ids
    FROM event_entities ee
   WHERE ee.event_id = p_event_id AND ee.role = 'organiser';

  IF v_organiser_ids IS NOT NULL AND array_length(v_organiser_ids, 1) > 0 THEN
    SELECT EXISTS (
      SELECT 1
        FROM event_raffle_entries ere
        JOIN event_entities ee2 ON ee2.event_id = ere.event_id AND ee2.role = 'organiser'
       WHERE ere.phone_e164 = v_clean_phone
         AND ere.deleted_at IS NULL
         AND ee2.entity_id = ANY(v_organiser_ids)
    ) INTO v_already;

    IF v_already THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_entered');
    END IF;
  END IF;

  -- Insert with structured duplicate handling (the partial unique index on
  -- (event_id, phone_e164) WHERE deleted_at IS NULL catches same-event
  -- duplicates; cross-event duplicates are caught by the eligibility check
  -- above. Both return 'already_entered' for a consistent client experience.)
  BEGIN
    INSERT INTO event_raffle_entries (
      event_id, first_name, phone_e164, consent_version, session_id
    ) VALUES (
      p_event_id, v_clean_name, v_clean_phone, p_consent_version, p_session_id
    ) RETURNING id INTO v_entry_id;

    RETURN jsonb_build_object('ok', true, 'entry_id', v_entry_id);

  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_entered');
  END;
END;
$function$;

COMMIT;

NOTIFY pgrst, 'reload schema';
