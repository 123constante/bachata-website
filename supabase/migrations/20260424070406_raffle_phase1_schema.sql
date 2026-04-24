-- =============================================================================
-- Raffle Phase 1 — Commit 2: schema migration
-- -----------------------------------------------------------------------------
-- Scope (locked with user):
--   1. Backfill events.has_raffle NULL → false, then SET NOT NULL DEFAULT false.
--   2. Add sync_raffle_flag() trigger that mirrors sync_guestlist_flag exactly,
--      keying off meta_data ? 'raffle'.
--   3. Create event_raffle_entries (public self-signup phone pool):
--        - E.164 phone check
--        - UNIQUE (event_id, phone_e164) full uniqueness
--        - deleted_at soft-delete column for audit
--   4. Create event_raffle_draws (draw history + rollback chain):
--        - prior_draw_id self-FK
--        - partial UNIQUE index enforcing one active draw per event
--   5. RLS on both tables:
--        - entries: anon + authenticated may INSERT only when the event is
--          published AND has_raffle = true; admin has full access
--        - draws:   admin-only, no public access
--   6. Grants aligned with the policies above.
--   7. NOTIFY pgrst, 'reload schema' at the very end (outside the txn).
--
-- NOT in this migration (deferred, by design):
--   - DROP events.raffle_config — deferred to Commit 6, where it is paired
--     with the admin_get_event_snapshot_v2 patch that stops reading the
--     column. Dropping it here would break that RPC at next call because
--     plpgsql bodies are late-bound.
--   - submit_raffle_entry / get_event_raffle RPCs — Commit 3.
--   - admin raffle draw RPCs — Commits 4–5.
--   - admin_save_event_v2_impl update for has_raffle input — Commit 6.
-- =============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. events.has_raffle — backfill + NOT NULL DEFAULT false
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.events
SET has_raffle = false
WHERE has_raffle IS NULL;

ALTER TABLE public.events
  ALTER COLUMN has_raffle SET DEFAULT false;

ALTER TABLE public.events
  ALTER COLUMN has_raffle SET NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. sync_raffle_flag() — mirrors sync_guestlist_flag exactly
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_raffle_flag()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.has_raffle := (
    NEW.meta_data IS NOT NULL
    AND NEW.meta_data ? 'raffle'
    AND NEW.meta_data->'raffle' IS DISTINCT FROM 'null'::jsonb
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_raffle_flag ON public.events;

CREATE TRIGGER trg_sync_raffle_flag
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_raffle_flag();

COMMENT ON FUNCTION public.sync_raffle_flag IS
  'Syncs meta_data.raffle presence to top-level has_raffle boolean on events.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. event_raffle_entries — public self-signup phone pool
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_raffle_entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  phone_e164  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,

  CONSTRAINT uq_event_raffle_phone UNIQUE (event_id, phone_e164),
  CONSTRAINT chk_raffle_phone_e164
    CHECK (phone_e164 ~ '^\+[1-9][0-9]{1,14}$')
);

CREATE INDEX IF NOT EXISTS idx_event_raffle_entries_event_id
  ON public.event_raffle_entries(event_id);

COMMENT ON TABLE public.event_raffle_entries IS
  'Public self-signup raffle entries. One row per phone per event. '
  'deleted_at is an audit-only soft-delete marker — the UNIQUE (event_id, '
  'phone_e164) constraint is full, so a soft-deleted phone cannot re-enter '
  'without a hard delete first.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. event_raffle_draws — draw history + rollback chain
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_raffle_draws (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       uuid        NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  prior_draw_id  uuid        REFERENCES public.event_raffle_draws(id) ON DELETE SET NULL,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  drawn_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_event_raffle_draws_event_id
  ON public.event_raffle_draws(event_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_raffle_draws_one_active_per_event
  ON public.event_raffle_draws(event_id)
  WHERE is_active = true;

COMMENT ON TABLE public.event_raffle_draws IS
  'Raffle draw history. prior_draw_id forms a rollback chain; the partial '
  'UNIQUE index on (event_id) WHERE is_active = true enforces at-most-one '
  'active draw per event.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RLS — table-level lock, then explicit policies
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.event_raffle_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_raffle_draws   ENABLE ROW LEVEL SECURITY;

-- Entries: public INSERT gated on published-event + has_raffle = true.
-- anon and authenticated both covered so a logged-in user can also enter.
CREATE POLICY anon_insert_raffle_entry
  ON public.event_raffle_entries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_raffle_entries.event_id
        AND e.lifecycle_status = 'published'
        AND e.has_raffle = true
    )
  );

-- Entries: admin full access (SELECT / INSERT / UPDATE / DELETE).
CREATE POLICY admin_all_raffle_entries
  ON public.event_raffle_entries
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Draws: admin-only, no public path.
CREATE POLICY admin_all_raffle_draws
  ON public.event_raffle_draws
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Grants
-- ─────────────────────────────────────────────────────────────────────────────

-- Table-level privileges. RLS policies above gate which rows each role sees.
GRANT INSERT ON public.event_raffle_entries TO anon;
GRANT INSERT ON public.event_raffle_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_raffle_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_raffle_draws   TO authenticated;

COMMIT;

-- Trigger PostgREST to pick up the new tables / functions immediately.
NOTIFY pgrst, 'reload schema';
