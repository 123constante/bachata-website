# RPC reference: admin PR #1576 migration at b4740246 (NOT applied to prod). Read-only reference for signatures and return shapes.
```sql
-- 20270321210000_organiser_raffle_nights_v1.sql  (placeholder version; the merger assigns the real one)
--
-- Organiser Raffle inside each night, Option B, PHASE 1 (admin). Brief: branch
-- brief/profile-dash-organiser-raffle-build, docs/briefs/profile-dash-organiser-raffle-build.md
-- (blob 91dbe40f). Builds on Raffle v2 (20270320080000 schema, 20270321060000 RPCs); it does not
-- redesign it. Opening/closing a raffle is a HARD STOP for automation: the write RPC refuses any
-- caller without a signed-in, non-anonymous user (service_role / cron / bulk scripts have no
-- auth.uid()), and it is granted to authenticated ONLY (not service_role).
--
-- Adds
--   raffle_wins.entries_at_draw   snapshot: eligible pool rows at the moment of the draw.
--   _raffle_v2_draw(uuid)         same body as #1355 plus the snapshot (prosrc pinned below).
--   _raffle_night_entries_count(occ)  ONE rule for "entries on a night": distinct pool rows with a
--                                 raffle_attendance row on the night or a raffle_wins row on the
--                                 night in locked/attended/no_show. (v2 has one general pool; a
--                                 person "enters" a night by locking it as a winner. The v1
--                                 per-series counts, max 135, are history and are not night-scoped.)
--   _raffle_night_is_locked(occ)  the server lock "once anyone has entered": entries_count > 0.
--   _organiser_raffle_role(series) 'admin' | 'owner' | 'manager' | 'contributor' | NULL, via
--                                 entity_members(entity_type 'organiser') on series.organiser_ids,
--                                 the raffle_door_caller_allowed vocabulary.
--   organiser_raffle_nights_v1(series)  READ, membership-gated (admin or any team role). One row
--                                 per night with a chip (draft|cancelled|past|drawn|locked|open|
--                                 closed), entries_count, winner first name + drawn_at (D6: first
--                                 names only), can_set + refuse reason, and view_only_reason
--                                 'ask an owner' for a contributor.
--   organiser_raffle_night_set_v1(occ, enabled)  WRITE (admin/owner/manager). Refuses: not_found,
--                                 not_authorised, enabled_required, draft, cancelled, past, locked.
--                                 Writes raffle_nights (enabled, set_by = auth.uid(), set_at).
--
-- Decisions taken here (owner may overturn; listed in the handover):
--   * Winner name: FIRST name only (the public board rule D6), never the phone.
--   * Draw -> occurrence_id: in v2 the draw contacts a person; the winner picks the night, and
--     raffle_win_lock_v1 already sets occurrence_id. The 16 prod wins with occurrence_id NULL are
--     all state 'contacted' (read 2026-11-12) = no night picked yet, which is correct. A drawn
--     night is a night with a locked/attended win; no draw-time night is invented here.
--   * Series default vs per-night: the write sets an explicit per-night override only (true/false);
--     the series default (53 series on, 0 overrides) stays an admin action (admin_raffle_series_set_v1).
--
-- Prod read 2026-11-12 (read-only): _raffle_v2_draw prosrc md5 51ef17a756c03d59ee7281dd098d7f46;
-- raffle_nights 0 rows; raffle_wins 16 (all contacted, occurrence_id NULL); 53 series raffle_enabled;
-- organiser member roles in use: owner, manager; occurrence lifecycle scheduled|cancelled;
-- series lifecycle draft|live|paused|ended|archived.
--
-- Rollback (shelf): supabase/rollbacks/99990102000003_organiser_raffle_nights_rollback.sql.

-- -- 0. Pin -------------------------------------------------------------------------------------------
DO $pin$
DECLARE v_src text;
BEGIN
  SELECT md5(p.prosrc) INTO v_src FROM pg_proc p WHERE p.oid = to_regprocedure('public._raffle_v2_draw(uuid)');
  IF v_src IS DISTINCT FROM '51ef17a756c03d59ee7281dd098d7f46' THEN
    RAISE EXCEPTION 'pin FAILED: _raffle_v2_draw(uuid) prosrc md5 is %', v_src;
  END IF;
END
$pin$;

-- -- 1. Snapshot column + draw ------------------------------------------------------------------------
ALTER TABLE public.raffle_wins ADD COLUMN IF NOT EXISTS entries_at_draw integer NULL;
COMMENT ON COLUMN public.raffle_wins.entries_at_draw IS
  'Eligible raffle_pool rows at the moment _raffle_v2_draw picked this win (snapshot). NULL for wins drawn before 20270321210000_organiser_raffle_nights_v1.';

CREATE OR REPLACE FUNCTION public._raffle_v2_draw(p_exclude uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_pool public.raffle_pool%ROWTYPE;
  v_win  public.raffle_wins%ROWTYPE;
  v_link text;
  v_entries integer;
BEGIN
  -- SKIP LOCKED + the recheck: two admins drawing at once never contact one person twice.
  SELECT p.* INTO v_pool FROM public.raffle_pool p
   WHERE public.raffle_pool_is_eligible(p.id) AND p.id IS DISTINCT FROM p_exclude
   ORDER BY random() LIMIT 1
     FOR UPDATE SKIP LOCKED;
  IF NOT FOUND OR NOT public.raffle_pool_is_eligible(v_pool.id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'pool_empty');
  END IF;
  -- Snapshot: how many people were in the draw (the picked row included).
  SELECT count(*)::integer INTO v_entries FROM public.raffle_pool p
   WHERE public.raffle_pool_is_eligible(p.id) AND p.id IS DISTINCT FROM p_exclude;
  INSERT INTO public.raffle_wins (pool_id, state, link_expires_at, drawn_by, entries_at_draw)
  VALUES (v_pool.id, 'contacted', now() + interval '7 days', auth.uid(), v_entries)
  RETURNING * INTO v_win;
  v_link := public._raffle_v2_win_link(v_win.link_token);
  RETURN jsonb_build_object('ok', true, 'win_id', v_win.id, 'first_name', v_pool.first_name,
                            'phone_e164', v_pool.phone_e164, 'link', v_link,
                            'message', public._raffle_v2_winner_message(v_pool.first_name, v_link),
                            'entries_at_draw', v_entries);
END;
$function$;

-- -- 2. Rules -----------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._raffle_night_entries_count(p_occurrence_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT count(DISTINCT x.pool_id)::integer FROM (
    SELECT a.pool_id FROM public.raffle_attendance a WHERE a.occurrence_id = p_occurrence_id
    UNION ALL
    SELECT w.pool_id FROM public.raffle_wins w
     WHERE w.occurrence_id = p_occurrence_id AND w.state IN ('locked', 'attended', 'no_show')) x;
$function$;

CREATE OR REPLACE FUNCTION public._raffle_night_is_locked(p_occurrence_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public._raffle_night_entries_count(p_occurrence_id) > 0;
$function$;

CREATE OR REPLACE FUNCTION public._organiser_raffle_role(p_series_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    WHEN COALESCE(public.is_admin(), false) THEN 'admin'
    ELSE (SELECT em.member_role
            FROM public.event_series_p5 s
            JOIN public.entity_members em
              ON em.entity_type = 'organiser'
             AND em.entity_id = ANY (COALESCE(s.organiser_ids, '{}'::uuid[]))
           WHERE s.id = p_series_id AND em.user_id = auth.uid()
             AND em.member_role IN ('owner', 'manager', 'contributor')
           ORDER BY CASE em.member_role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
           LIMIT 1)
  END;
$function$;

-- Per-night shape; p_can_edit = the caller's role may write.
CREATE OR REPLACE FUNCTION public._organiser_raffle_night_row(p_occurrence_id uuid, p_can_edit boolean)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH n AS (
    SELECT o.id, o.occurrence_date, o.materialised_start_utc,
           s.lifecycle_status AS series_status, o.lifecycle_status AS occ_status,
           rn.enabled AS override, COALESCE(rn.enabled, s.raffle_enabled) AS effective,
           COALESCE(public.raffle_occurrence_has_ended(o.id), true) AS ended,
           public._raffle_night_entries_count(o.id) AS entries,
           (SELECT jsonb_build_object('first_name', p.first_name, 'drawn_at', w.contacted_at,
                                      'locked_at', w.locked_at, 'state', w.state,
                                      'entries_at_draw', w.entries_at_draw)
              FROM public.raffle_wins w JOIN public.raffle_pool p ON p.id = w.pool_id
             WHERE w.occurrence_id = o.id AND w.state IN ('locked', 'attended')
             ORDER BY w.locked_at DESC NULLS LAST LIMIT 1) AS winner
      FROM public.event_occurrence_p5 o
      JOIN public.event_series_p5 s ON s.id = o.series_id
      LEFT JOIN public.raffle_nights rn ON rn.occurrence_id = o.id
     WHERE o.id = p_occurrence_id),
  c AS (
    SELECT n.*,
           CASE WHEN n.series_status NOT IN ('live', 'paused', 'ended') THEN 'draft'
                WHEN n.occ_status = 'cancelled' THEN 'cancelled'
                WHEN n.winner IS NOT NULL THEN 'drawn'
                WHEN n.ended THEN 'past'
                WHEN n.entries > 0 THEN 'locked'
                WHEN n.effective THEN 'open'
                ELSE 'closed' END AS chip,
           CASE WHEN n.series_status NOT IN ('live', 'paused', 'ended') THEN 'draft'
                WHEN n.occ_status = 'cancelled' THEN 'cancelled'
                WHEN n.ended THEN 'past'
                WHEN n.entries > 0 THEN 'locked'
                ELSE NULL END AS refuse
      FROM n)
  SELECT jsonb_build_object(
           'occurrence_id', c.id,
           'date', c.occurrence_date,
           'start_local', to_char(c.materialised_start_utc AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS'),
           'chip', c.chip,
           'raffle_on', c.effective,
           'night_override', c.override,
           'entries_count', c.entries,
           'locked', c.entries > 0,
           'winner', c.winner,
           'can_set', p_can_edit AND c.refuse IS NULL,
           'refuse_reason', c.refuse)
    FROM c;
$function$;

-- -- 3. Read ------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organiser_raffle_nights_v1(p_series_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text;
  v_series public.event_series_p5%ROWTYPE;
  v_edit boolean;
BEGIN
  IF auth.uid() IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  SELECT * INTO v_series FROM public.event_series_p5 WHERE id = p_series_id;
  v_role := CASE WHEN v_series.id IS NULL THEN NULL ELSE public._organiser_raffle_role(p_series_id) END;
  -- not_found and not_authorised answer alike: a non-member learns nothing about the series.
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorised');
  END IF;
  v_edit := v_role IN ('admin', 'owner', 'manager');
  RETURN jsonb_build_object(
    'ok', true,
    'series_id', v_series.id,
    'series_raffle_enabled', v_series.raffle_enabled,
    'role', v_role,
    'can_edit', v_edit,
    'view_only_reason', CASE WHEN v_edit THEN NULL ELSE 'ask an owner' END,
    'nights', COALESCE((
       SELECT jsonb_agg(public._organiser_raffle_night_row(o.id, v_edit)
                        ORDER BY o.occurrence_date, o.materialised_start_utc, o.id)
         FROM public.event_occurrence_p5 o WHERE o.series_id = p_series_id), '[]'::jsonb));
END;
$function$;

-- -- 4. Write (HARD STOP for automation) -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organiser_raffle_night_set_v1(p_occurrence_id uuid, p_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_series uuid;
  v_role text;
  v_row jsonb;
BEGIN
  -- A signed-in person only: no service_role, cron, agent or bulk path has auth.uid().
  IF v_uid IS NULL OR COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) THEN
    RAISE EXCEPTION 'not_authenticated: a signed-in team member must open or close a raffle' USING ERRCODE = '28000';
  END IF;
  SELECT o.series_id INTO v_series FROM public.event_occurrence_p5 o WHERE o.id = p_occurrence_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorised');
  END IF;
  v_role := public._organiser_raffle_role(v_series);
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authorised');
  END IF;
  IF v_role NOT IN ('admin', 'owner', 'manager') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'view_only', 'message', 'ask an owner');
  END IF;
  IF p_enabled IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'enabled_required');
  END IF;
  v_row := public._organiser_raffle_night_row(p_occurrence_id, true);
  IF v_row ->> 'refuse_reason' IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', v_row ->> 'refuse_reason', 'night', v_row);
  END IF;
  INSERT INTO public.raffle_nights (occurrence_id, enabled, set_by, set_at)
  VALUES (p_occurrence_id, p_enabled, v_uid, now())
  ON CONFLICT (occurrence_id) DO UPDATE SET enabled = EXCLUDED.enabled, set_by = EXCLUDED.set_by, set_at = now();
  RETURN jsonb_build_object('ok', true, 'night', public._organiser_raffle_night_row(p_occurrence_id, true));
END;
$function$;

-- -- 5. ACL -------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public._raffle_night_entries_count(uuid)               FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._raffle_night_is_locked(uuid)                   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._organiser_raffle_role(uuid)                    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._organiser_raffle_night_row(uuid, boolean)      FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._raffle_night_entries_count(uuid)            TO service_role;
GRANT EXECUTE ON FUNCTION public._raffle_night_is_locked(uuid)                TO service_role;
GRANT EXECUTE ON FUNCTION public._organiser_raffle_role(uuid)                 TO service_role;
GRANT EXECUTE ON FUNCTION public._organiser_raffle_night_row(uuid, boolean)   TO service_role;
REVOKE ALL ON FUNCTION public.organiser_raffle_nights_v1(uuid)                FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organiser_raffle_nights_v1(uuid)             TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.organiser_raffle_night_set_v1(uuid, boolean)    FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.organiser_raffle_night_set_v1(uuid, boolean) TO authenticated;

-- -- 6. Self-verify (rolled back) ---------------------------------------------------------------------
DO $verify$
DECLARE
  v_series uuid;
  v_occ uuid;
  v_r jsonb;
  v_raised boolean;
BEGIN
  -- ACL
  IF has_function_privilege('anon', 'public.organiser_raffle_night_set_v1(uuid,boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.organiser_raffle_nights_v1(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify FAILED: anon can execute an organiser raffle RPC';
  END IF;
  IF has_function_privilege('service_role', 'public.organiser_raffle_night_set_v1(uuid,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify FAILED: service_role can execute the raffle write (hard stop)';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.organiser_raffle_night_set_v1(uuid,boolean)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public._organiser_raffle_night_row(uuid,boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'verify FAILED: authenticated ACL wrong';
  END IF;

  SELECT s.id, o.id INTO v_series, v_occ FROM public.event_series_p5 s
    JOIN public.event_occurrence_p5 o ON o.series_id = s.id
   WHERE s.raffle_enabled ORDER BY o.occurrence_date DESC LIMIT 1;

  -- No uid (agent / service path): the write raises 28000 and writes nothing.
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_raised := false;
  BEGIN
    PERFORM public.organiser_raffle_night_set_v1(v_occ, false);
  EXCEPTION WHEN SQLSTATE '28000' THEN v_raised := true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'verify FAILED: write accepted a caller with no user'; END IF;

  -- A random signed-in non-member: not_authorised on both RPCs.
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', gen_random_uuid()::text, 'role', 'authenticated')::text, true);
  v_r := public.organiser_raffle_night_set_v1(v_occ, false);
  IF v_r ->> 'reason' IS DISTINCT FROM 'not_authorised' THEN
    RAISE EXCEPTION 'verify FAILED: non-member write answered %', v_r;
  END IF;
  v_r := public.organiser_raffle_nights_v1(v_series);
  IF v_r ->> 'reason' IS DISTINCT FROM 'not_authorised' THEN
    RAISE EXCEPTION 'verify FAILED: non-member read answered %', v_r;
  END IF;
  IF EXISTS (SELECT 1 FROM public.raffle_nights WHERE occurrence_id = v_occ) THEN
    RAISE EXCEPTION 'verify FAILED: a refused write left a raffle_nights row';
  END IF;
  -- Every chip value of the rule is one of the seven.
  IF EXISTS (SELECT 1 FROM public.event_occurrence_p5 o
              WHERE o.series_id = v_series
                AND public._organiser_raffle_night_row(o.id, true) ->> 'chip'
                    NOT IN ('draft', 'cancelled', 'past', 'drawn', 'locked', 'open', 'closed')) THEN
    RAISE EXCEPTION 'verify FAILED: unknown chip';
  END IF;
  PERFORM set_config('request.jwt.claims', '', true);
  RAISE NOTICE 'organiser_raffle_nights_v1 self-verify OK (series %, night %)', v_series, v_occ;
END
$verify$;

SELECT public.mark_migration_complete('20270321210000_organiser_raffle_nights_v1');
```
