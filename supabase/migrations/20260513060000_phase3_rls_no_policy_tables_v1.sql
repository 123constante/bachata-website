-- ============================================================================
-- Phase 3.3 (2026-05-13): add explicit deny-all policies to 11 tables that
-- have RLS enabled but zero policies.
--
-- When RLS is on with no policies, Postgres defaults to deny-all for all
-- roles except service_role (which bypasses RLS). That is the correct
-- behaviour for these tables. This migration makes the intent explicit via
-- restrictive deny-all policies, matching the Phase 2.5 pattern used for
-- override_payload_strip_audit_v1 and event_drafts_archive_2026_05_05.
--
-- All 11 tables are written exclusively via SECURITY DEFINER RPCs or edge
-- functions. None require direct SELECT from anon/authenticated callers.
-- service_role bypasses RLS so archival/operational tooling keeps working.
--
-- Table purpose:
--   edge_auth_bootstrap_manifest   — edge function bootstrap state, internal
--   listing_request_email_log      — admin email send log (edge fn writes)
--   listing_request_status_history — admin-managed status audit trail
--   listing_request_throttle       — per-IP rate limiter (submit_listing_request_v1)
--   listing_requests               — public form submissions via RPC only
--   organiser_card_clicks          — click tracking written by SECURITY DEFINER RPC
--   pending_canonical_keys         — internal dedup state
--   person_merge_decisions         — admin-only person-merge workflow
--   profile_view_events            — click tracking written by SECURITY DEFINER RPC
--   search_queries                 — query log written by record_search_query_v1
--   trigger_layer_manifest         — internal trigger registry
-- ============================================================================

-- edge_auth_bootstrap_manifest
DROP POLICY IF EXISTS "deny_all_phase3" ON public.edge_auth_bootstrap_manifest;
CREATE POLICY "deny_all_phase3"
  ON public.edge_auth_bootstrap_manifest
  AS RESTRICTIVE FOR ALL TO public
  USING (false) WITH CHECK (false);

-- listing_request_email_log
DROP POLICY IF EXISTS "deny_all_phase3" ON public.listing_request_email_log;
CREATE POLICY "deny_all_phase3"
  ON public.listing_request_email_log
  AS RESTRICTIVE FOR ALL TO public
  USING (false) WITH CHECK (false);

-- listing_request_status_history
DROP POLICY IF EXISTS "deny_all_phase3" ON public.listing_request_status_history;
CREATE POLICY "deny_all_phase3"
  ON public.listing_request_status_history
  AS RESTRICTIVE FOR ALL TO public
  USING (false) WITH CHECK (false);

-- listing_request_throttle
DROP POLICY IF EXISTS "deny_all_phase3" ON public.listing_request_throttle;
CREATE POLICY "deny_all_phase3"
  ON public.listing_request_throttle
  AS RESTRICTIVE FOR ALL TO public
  USING (false) WITH CHECK (false);

-- listing_requests
DROP POLICY IF EXISTS "deny_all_phase3" ON public.listing_requests;
CREATE POLICY "deny_all_phase3"
  ON public.listing_requests
  AS RESTRICTIVE FOR ALL TO public
  USING (false) WITH CHECK (false);

-- organiser_card_clicks
DROP POLICY IF EXISTS "deny_all_phase3" ON public.organiser_card_clicks;
CREATE POLICY "deny_all_phase3"
  ON public.organiser_card_clicks
  AS RESTRICTIVE FOR ALL TO public
  USING (false) WITH CHECK (false);

-- pending_canonical_keys
DROP POLICY IF EXISTS "deny_all_phase3" ON public.pending_canonical_keys;
CREATE POLICY "deny_all_phase3"
  ON public.pending_canonical_keys
  AS RESTRICTIVE FOR ALL TO public
  USING (false) WITH CHECK (false);

-- person_merge_decisions
DROP POLICY IF EXISTS "deny_all_phase3" ON public.person_merge_decisions;
CREATE POLICY "deny_all_phase3"
  ON public.person_merge_decisions
  AS RESTRICTIVE FOR ALL TO public
  USING (false) WITH CHECK (false);

-- profile_view_events
DROP POLICY IF EXISTS "deny_all_phase3" ON public.profile_view_events;
CREATE POLICY "deny_all_phase3"
  ON public.profile_view_events
  AS RESTRICTIVE FOR ALL TO public
  USING (false) WITH CHECK (false);

-- search_queries
DROP POLICY IF EXISTS "deny_all_phase3" ON public.search_queries;
CREATE POLICY "deny_all_phase3"
  ON public.search_queries
  AS RESTRICTIVE FOR ALL TO public
  USING (false) WITH CHECK (false);

-- trigger_layer_manifest
DROP POLICY IF EXISTS "deny_all_phase3" ON public.trigger_layer_manifest;
CREATE POLICY "deny_all_phase3"
  ON public.trigger_layer_manifest
  AS RESTRICTIVE FOR ALL TO public
  USING (false) WITH CHECK (false);

notify pgrst, 'reload schema';
