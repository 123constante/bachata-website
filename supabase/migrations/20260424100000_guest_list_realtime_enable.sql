-- Guest list realtime enablement
--
-- Goal: let anon clients subscribe to live INSERT events on
-- public.event_guest_list_entries so other viewers of an event page see
-- names appear as they are added.
--
-- Findings that make this migration necessary:
--   * event_guest_list_entries has RLS enabled but ZERO policies.
--     The existing submit_guest_list_entry and get_event_guest_list RPCs
--     are SECURITY DEFINER, so they bypass RLS — nothing else could read
--     the table. Supabase realtime respects RLS for delivery, so without
--     an anon SELECT policy, no realtime INSERT events reach the browser.
--   * The table is NOT in the supabase_realtime publication, so logical
--     replication is not capturing changes for it.
--   * REPLICA IDENTITY is default (primary key) — sufficient for INSERT
--     events; UPDATE/DELETE capture would need FULL, which we do not need.
--
-- Privacy review:
--   Columns are (id uuid, event_id uuid, first_name text, created_at
--   timestamptz). first_name is already surfaced publicly by
--   get_event_guest_list, so this policy exposes no additional
--   information beyond what the event page already shows.

-- 1) Anon + authenticated can SELECT entries for events that have the
--    guest list feature enabled. Mirrors the RPC's own precondition.
DROP POLICY IF EXISTS "event_guest_list_entries_public_read"
  ON public.event_guest_list_entries;

CREATE POLICY "event_guest_list_entries_public_read"
  ON public.event_guest_list_entries
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_guest_list_entries.event_id
        AND e.has_guestlist = TRUE
    )
  );

-- 2) Add the table to the realtime publication (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_guest_list_entries'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.event_guest_list_entries;
  END IF;
END
$$;
