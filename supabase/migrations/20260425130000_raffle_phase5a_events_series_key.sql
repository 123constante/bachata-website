-- ============================================================================
-- Raffle Phase 5A — events.series_key for cross-event raffle grouping
-- ============================================================================
-- Added by Cowork on 2026-04-24. Timestamped 2026-04-25 13:00:00 so it orders
-- after the Phase 2D migration (20260425120000).
--
-- Motivation: raffles today live on single event rows, but Ricky's actual
-- raffles run on weekly recurring events. Phase 5's two-tier exclusion model
-- (silent series-repeat at draw time + visible admin-editorial exclusion on
-- the public site) needs a way to group events into a "series".
--
-- The audit on 2026-04-24 found:
--   - parent_event_id and source_occurrence_id exist but are 0/31 populated.
--     Leaving them alone in case another subsystem takes them over later.
--   - Event names use editorial conventions that an auto-slug cannot capture
--     (e.g. "Sensual Vibes - Antoni & Belen" and "Sensual Vibes - Ken vs
--     Barbie" are one series, six events). Auto-populating series_key from
--     the name would fragment the series.
--
-- Decision: add series_key as a nullable text column, default NULL. No
-- auto-populate. Ricky sets it explicitly via the admin event editor for
-- events that should share raffle fairness. NULL = "treat as standalone
-- event" = current Phase 2-4 behaviour.
--
-- This migration is metadata-only:
--   - Adds the column
--   - Adds an index to keep series lookups cheap
--   - Adds a comment documenting the semantic
--   - Reloads PostgREST schema
-- No RPC changes. Phase 5B / 5C / 5D / 5E follow in separate migrations.
-- ============================================================================

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS series_key text NULL;

COMMENT ON COLUMN public.events.series_key IS
  'Optional slug grouping multiple events into a single raffle series. NULL means the event is standalone for raffle fairness. Set manually via the admin event editor; events sharing a value are treated as the same series by Phase 5 series-aware raffle RPCs (silent repeat-attendee exclusion at draw time, prize inheritance). Not auto-populated — the audit on 2026-04-24 showed event naming conventions that no slug can capture reliably (e.g. "Sensual Vibes - {theme}" is one series across six distinct names).';

-- Partial index: only non-null values are interesting. Cheap on small tables
-- now; starts paying off once series_repeat queries run on every draw.
CREATE INDEX IF NOT EXISTS idx_events_series_key
  ON public.events (series_key)
  WHERE series_key IS NOT NULL;

-- Reload PostgREST so the column is visible via REST/RPC layer.
NOTIFY pgrst, 'reload schema';

COMMIT;
