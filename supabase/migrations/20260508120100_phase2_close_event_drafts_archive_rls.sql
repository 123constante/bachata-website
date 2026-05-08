-- Phase 2.5 (continued): close the second RLS-disabled-public ERROR.
--
-- public.event_drafts_archive_2026_05_05 is a 209-row archive of drafts
-- created during the 2026-05-05 housekeeping pass. Like override_payload_strip_audit_v1
-- it is service-role-managed and should not be readable by anon/authenticated.
-- Same pattern as 20260508120000: enable RLS + restrictive deny-all policy;
-- service_role bypasses RLS so archival/restore tooling keeps working.

alter table public.event_drafts_archive_2026_05_05 enable row level security;

drop policy if exists "deny_all_phase2" on public.event_drafts_archive_2026_05_05;
create policy "deny_all_phase2"
  on public.event_drafts_archive_2026_05_05
  as restrictive
  for all
  to public
  using (false)
  with check (false);

notify pgrst, 'reload schema';
