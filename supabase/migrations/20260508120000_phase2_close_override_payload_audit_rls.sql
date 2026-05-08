-- Phase 2.5: Close the last security ERROR advisor.
--
-- public.override_payload_strip_audit_v1 had RLS disabled while remaining
-- accessible to anon/authenticated roles. The table is an audit log written
-- by service-role triggers/functions. Service-role bypasses RLS, so enabling
-- RLS + a deny-all policy stops anon/authenticated reads without breaking
-- the writer.
--
-- Decision (Ricky, 2026-05-08): keep in `public` schema, do NOT move.

alter table public.override_payload_strip_audit_v1 enable row level security;

-- Restrictive deny-all: applies to every role (PUBLIC = anon, authenticated,
-- and any other non-service role). service_role bypasses RLS entirely and is
-- unaffected.
drop policy if exists "deny_all_phase2" on public.override_payload_strip_audit_v1;
create policy "deny_all_phase2"
  on public.override_payload_strip_audit_v1
  as restrictive
  for all
  to public
  using (false)
  with check (false);

-- Force PostgREST to refresh its schema cache so the new policy is honoured.
notify pgrst, 'reload schema';
