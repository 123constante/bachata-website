BEGIN;

CREATE OR REPLACE FUNCTION public.submit_raffle_entry(
  p_event_id         uuid,
  p_first_name       text,
  p_phone_e164       text,
  p_consent_version  text,
  p_honeypot         text DEFAULT NULL,
  p_session_id       uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.submit_raffle_entry(uuid, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_raffle_entry(uuid, text, text, text, text, uuid) TO anon, authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
