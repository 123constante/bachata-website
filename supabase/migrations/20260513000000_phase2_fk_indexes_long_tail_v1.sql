-- ============================================================================
-- Phase 2.6 (2026-05-08): index the remaining 43 unindexed foreign keys.
--
-- Phase 1 (20260512000000_add_missing_fk_indexes_v1) covered 5 high-priority
-- FKs. The supabase performance advisor still flags 44 more. Live verification
-- via pg_constraint + pg_index confirmed every one of these has zero
-- prefix-covering index on its referencing columns.
--
-- Skipped: dancer_profiles_legacy_backup.fk_dancer_profiles_nationality_code_countries_code
--   — pure backup table, frozen, never read in production paths. The advisor
--     flag here is theoretical; indexing would only add disk + write
--     overhead the table will never recoup.
--
-- All other tables get an index regardless of current size. Most are <50
-- rows today, but several (calendar_occurrences, event_views, raffle entries,
-- dancer/member profiles) will grow with usage. Index cost on small tables
-- is negligible; the operational risk of a deleted parent triggering a seq
-- scan is real and easy to forget about later.
--
-- Plain CREATE INDEX (no CONCURRENTLY) per Phase 1 precedent: these tables
-- are tiny on prod, the SHARE lock is microseconds, and CONCURRENTLY is
-- incompatible with Supabase's per-migration transaction wrap.
--
-- Idempotent via IF NOT EXISTS.
-- ============================================================================

-- High-traffic (>100 live rows)
CREATE INDEX IF NOT EXISTS idx_calendar_occurrences_cancellation_reason_label
  ON public.calendar_occurrences (cancellation_reason_label);
CREATE INDEX IF NOT EXISTS idx_profile_view_events_event_id
  ON public.profile_view_events (event_id);

-- Mid-traffic (10-100 live rows)
CREATE INDEX IF NOT EXISTS idx_event_raffle_entries_eligibility_override_by
  ON public.event_raffle_entries (eligibility_override_by);
CREATE INDEX IF NOT EXISTS idx_event_raffle_entries_ineligible_by
  ON public.event_raffle_entries (ineligible_by);
CREATE INDEX IF NOT EXISTS idx_event_program_people_created_by
  ON public.event_program_people (created_by);
CREATE INDEX IF NOT EXISTS idx_events_created_by
  ON public.events (created_by);
CREATE INDEX IF NOT EXISTS idx_event_save_audit_saved_by
  ON public.event_save_audit (saved_by);

-- Low-traffic but production-active
CREATE INDEX IF NOT EXISTS idx_guest_entry_erasure_tokens_event_id
  ON public.guest_entry_erasure_tokens (event_id);
CREATE INDEX IF NOT EXISTS idx_guest_entry_erasure_tokens_issued_by
  ON public.guest_entry_erasure_tokens (issued_by);
CREATE INDEX IF NOT EXISTS idx_event_program_section_rooms_venue_room_id
  ON public.event_program_section_rooms (venue_room_id);
CREATE INDEX IF NOT EXISTS idx_venue_rooms_created_by
  ON public.venue_rooms (created_by);
CREATE INDEX IF NOT EXISTS idx_dancer_profiles_based_city_id
  ON public.dancer_profiles (based_city_id);
CREATE INDEX IF NOT EXISTS idx_dancer_profiles_created_by
  ON public.dancer_profiles (created_by);
CREATE INDEX IF NOT EXISTS idx_member_profiles_auth_user_id
  ON public.member_profiles (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_listing_requests_duplicate_of_request_id
  ON public.listing_requests (duplicate_of_request_id);
CREATE INDEX IF NOT EXISTS idx_listing_requests_published_event_id
  ON public.listing_requests (published_event_id);
CREATE INDEX IF NOT EXISTS idx_organiser_team_members_member_profile_id
  ON public.organiser_team_members (member_profile_id);

-- Future-active (currently 0 live rows; indexed pre-emptively so growth
-- doesn't surface a perf cliff later)
CREATE INDEX IF NOT EXISTS idx_calendar_occurrence_session_people_overrides_remove_program_people_id
  ON public.calendar_occurrence_session_people_overrides (remove_program_people_id);
CREATE INDEX IF NOT EXISTS idx_calendar_occurrence_session_people_overrides_program_item_id
  ON public.calendar_occurrence_session_people_overrides (program_item_id);
CREATE INDEX IF NOT EXISTS idx_event_passes_event_id
  ON public.event_passes (event_id);
CREATE INDEX IF NOT EXISTS idx_event_profile_connections_created_by
  ON public.event_profile_connections (created_by);
CREATE INDEX IF NOT EXISTS idx_event_raffle_draws_drawn_by
  ON public.event_raffle_draws (drawn_by);
CREATE INDEX IF NOT EXISTS idx_event_raffle_draws_winner_entry_id
  ON public.event_raffle_draws (winner_entry_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user_id
  ON public.event_registrations (user_id);
CREATE INDEX IF NOT EXISTS idx_facility_options_updated_by
  ON public.facility_options (updated_by);
CREATE INDEX IF NOT EXISTS idx_floor_type_options_updated_by
  ON public.floor_type_options (updated_by);
CREATE INDEX IF NOT EXISTS idx_guest_dancer_profiles_created_by
  ON public.guest_dancer_profiles (created_by);
CREATE INDEX IF NOT EXISTS idx_occurrence_venue_drift_repair_audit_v1_repaired_by
  ON public.occurrence_venue_drift_repair_audit_v1 (repaired_by);
CREATE INDEX IF NOT EXISTS idx_pending_venue_rooms_created_by
  ON public.pending_venue_rooms (created_by);
CREATE INDEX IF NOT EXISTS idx_pending_venue_rooms_resolved_by
  ON public.pending_venue_rooms (resolved_by);
CREATE INDEX IF NOT EXISTS idx_pending_venue_rooms_source_event_id
  ON public.pending_venue_rooms (source_event_id);
CREATE INDEX IF NOT EXISTS idx_pending_venue_rooms_suggested_room_id
  ON public.pending_venue_rooms (suggested_room_id);
CREATE INDEX IF NOT EXISTS idx_person_account_links_created_by
  ON public.person_account_links (created_by);
CREATE INDEX IF NOT EXISTS idx_person_identities_created_by
  ON public.person_identities (created_by);
CREATE INDEX IF NOT EXISTS idx_person_profiles_created_by
  ON public.person_profiles (created_by);
CREATE INDEX IF NOT EXISTS idx_profile_claims_user_id
  ON public.profile_claims (user_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_created_by
  ON public.promo_codes (created_by);
CREATE INDEX IF NOT EXISTS idx_raffle_presets_created_by
  ON public.raffle_presets (created_by);
CREATE INDEX IF NOT EXISTS idx_reference_data_audit_changed_by
  ON public.reference_data_audit (changed_by);
CREATE INDEX IF NOT EXISTS idx_vendors_created_by
  ON public.vendors (created_by);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id
  ON public.vendors (user_id);
CREATE INDEX IF NOT EXISTS idx_venue_room_aliases_created_by
  ON public.venue_room_aliases (created_by);
CREATE INDEX IF NOT EXISTS idx_videographers_user_id
  ON public.videographers (user_id);
