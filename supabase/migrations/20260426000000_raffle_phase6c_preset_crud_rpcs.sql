-- =============================================================================
-- Phase 6C — Admin RPCs for raffle preset CRUD
--
-- Three new SECURITY DEFINER functions, all guarded by public.is_admin():
--
--   1. admin_list_raffle_presets_v1(p_include_archived boolean DEFAULT false)
--        → jsonb array of preset rows + usage_count (events using this preset
--          that haven't started more than 7 days ago)
--
--   2. admin_save_raffle_preset_v1(p_id, p_slug, p_name, p_prize_text,
--                                  p_cutoff_offset_minutes,
--                                  p_show_winner_publicly,
--                                  p_consent_version)
--        → upsert. p_id NULL → create. p_id UUID → update.
--          Refuses on duplicate slug (excluding self) or invalid inputs.
--
--   3. admin_archive_raffle_preset_v1(p_preset_id uuid)
--        → soft-delete. Refuses with 'in_use' if any events.raffle_preset_id
--          still points at the preset (force unassign first).
--
-- All return a jsonb envelope:
--   { ok: boolean, reason?: string, ...payload }
--
-- Reason codes (mark_save):
--   slug_required, name_required, prize_text_required, invalid_cutoff_offset,
--   slug_conflict, not_found, archived
-- Reason codes (archive):
--   preset_id_required, in_use (with event_count), not_found_or_already_archived
-- =============================================================================


-- ---------------------------------------------------------------------------
-- public.admin_list_raffle_presets_v1
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_raffle_presets_v1(
  p_include_archived boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',                    p.id,
      'slug',                  p.slug,
      'name',                  p.name,
      'prize_text',            p.prize_text,
      'cutoff_offset_minutes', p.cutoff_offset_minutes,
      'show_winner_publicly',  p.show_winner_publicly,
      'consent_version',       p.consent_version,
      'is_archived',           p.is_archived,
      'created_at',            p.created_at,
      'updated_at',            p.updated_at,
      'usage_count', (
        SELECT COUNT(*)
          FROM events e
         WHERE e.raffle_preset_id = p.id
           AND e.lifecycle_status = 'published'
           AND (e.start_time IS NULL OR e.start_time >= now() - interval '7 days')
      )
    ) ORDER BY p.is_archived ASC, p.created_at ASC
  ), '[]'::jsonb)
  INTO v_result
  FROM raffle_presets p
  WHERE (p_include_archived OR p.is_archived = false);

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_list_raffle_presets_v1(boolean) TO authenticated;


-- ---------------------------------------------------------------------------
-- public.admin_save_raffle_preset_v1 — upsert
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_save_raffle_preset_v1(
  p_id uuid DEFAULT NULL,
  p_slug text DEFAULT NULL,
  p_name text DEFAULT NULL,
  p_prize_text text DEFAULT NULL,
  p_cutoff_offset_minutes int DEFAULT NULL,
  p_show_winner_publicly boolean DEFAULT NULL,
  p_consent_version text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id  uuid;
  v_id       uuid;
  v_existing record;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_user_id := auth.uid();

  -- Validate inputs
  IF p_slug IS NULL OR trim(p_slug) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slug_required');
  END IF;
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'name_required');
  END IF;
  IF p_prize_text IS NULL OR trim(p_prize_text) = '' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'prize_text_required');
  END IF;
  IF p_cutoff_offset_minutes IS NULL
     OR p_cutoff_offset_minutes < 0
     OR p_cutoff_offset_minutes > 1440 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_cutoff_offset');
  END IF;

  -- Slug-uniqueness check (excluding self when updating)
  IF EXISTS (
    SELECT 1 FROM raffle_presets
     WHERE slug = trim(p_slug)
       AND (p_id IS NULL OR id <> p_id)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'slug_conflict');
  END IF;

  IF p_id IS NULL THEN
    -- Create
    INSERT INTO raffle_presets (
      slug,
      name,
      prize_text,
      cutoff_offset_minutes,
      show_winner_publicly,
      consent_version,
      created_by
    )
    VALUES (
      trim(p_slug),
      trim(p_name),
      trim(p_prize_text),
      p_cutoff_offset_minutes,
      COALESCE(p_show_winner_publicly, false),
      COALESCE(NULLIF(trim(p_consent_version), ''), 'v1'),
      v_user_id
    )
    RETURNING id INTO v_id;
  ELSE
    -- Update — refuse if archived
    SELECT * INTO v_existing FROM raffle_presets WHERE id = p_id;
    IF v_existing.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;
    IF v_existing.is_archived THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'archived');
    END IF;

    UPDATE raffle_presets SET
      slug                  = trim(p_slug),
      name                  = trim(p_name),
      prize_text            = trim(p_prize_text),
      cutoff_offset_minutes = p_cutoff_offset_minutes,
      show_winner_publicly  = COALESCE(p_show_winner_publicly, show_winner_publicly),
      consent_version       = COALESCE(NULLIF(trim(p_consent_version), ''), consent_version),
      updated_at            = now()
    WHERE id = p_id;

    v_id := p_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'preset_id', v_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_save_raffle_preset_v1(uuid, text, text, text, int, boolean, text) TO authenticated;


-- ---------------------------------------------------------------------------
-- public.admin_archive_raffle_preset_v1 — soft delete
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_archive_raffle_preset_v1(
  p_preset_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_preset_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'preset_id_required');
  END IF;

  -- Refuse if any event still references this preset
  SELECT COUNT(*) INTO v_count
    FROM events
   WHERE raffle_preset_id = p_preset_id;

  IF v_count > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'in_use',
      'event_count', v_count
    );
  END IF;

  UPDATE raffle_presets
     SET is_archived = true,
         updated_at = now()
   WHERE id = p_preset_id
     AND is_archived = false;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found_or_already_archived');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_archive_raffle_preset_v1(uuid) TO authenticated;


NOTIFY pgrst, 'reload schema';
