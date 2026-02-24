-- Migration: unify event + festival attendance under events + event_participants
-- Goal:
--   1) Standardize events.type to 'festival' | 'standard'
--   2) Standardize attendance statuses to 'interested' | 'going'
--   3) Enforce idempotent upsert shape with unique (user_id, event_id)
--   4) Backfill dancers.festival_plans into event_participants
--   5) Mark dancers.festival_plans deprecated

-- -----------------------------------------------------------------------------
-- STEP 1: Normalize events.type
-- -----------------------------------------------------------------------------
ALTER TABLE public.events
  ALTER COLUMN type SET DEFAULT 'standard';

UPDATE public.events
SET type = 'standard'
WHERE type IS NULL OR btrim(type) = '';

UPDATE public.events
SET type = CASE WHEN lower(type) = 'festival' THEN 'festival' ELSE 'standard' END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'events_type_supported_chk'
      AND conrelid = 'public.events'::regclass
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_type_supported_chk
      CHECK (type IN ('festival', 'standard'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 2: Normalize event_participants statuses and timestamps
-- -----------------------------------------------------------------------------
UPDATE public.event_participants
SET status = lower(btrim(status));

UPDATE public.event_participants
SET status = 'interested'
WHERE status NOT IN ('interested', 'going');

UPDATE public.event_participants
SET updated_at = COALESCE(updated_at, created_at, now());

ALTER TABLE public.event_participants
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_participants_status_chk'
      AND conrelid = 'public.event_participants'::regclass
  ) THEN
    ALTER TABLE public.event_participants
      ADD CONSTRAINT event_participants_status_chk
      CHECK (status IN ('interested', 'going'));
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 3: De-duplicate rows before adding unique constraint
-- Keep strongest status first: going > interested; then latest updated_at
-- -----------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    ctid,
    event_id,
    user_id,
    status,
    updated_at,
    created_at,
    row_number() OVER (
      PARTITION BY event_id, user_id
      ORDER BY
        CASE status WHEN 'going' THEN 2 WHEN 'interested' THEN 1 ELSE 0 END DESC,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST
    ) AS rn
  FROM public.event_participants
)
DELETE FROM public.event_participants ep
USING ranked r
WHERE ep.ctid = r.ctid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS event_participants_user_event_uidx
  ON public.event_participants (user_id, event_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'event_participants_user_event_key'
      AND conrelid = 'public.event_participants'::regclass
  ) THEN
    ALTER TABLE public.event_participants
      ADD CONSTRAINT event_participants_user_event_key
      UNIQUE USING INDEX event_participants_user_event_uidx;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 4: Recommended indexes for read patterns
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS event_participants_event_status_idx
  ON public.event_participants (event_id, status);

CREATE INDEX IF NOT EXISTS event_participants_user_status_updated_idx
  ON public.event_participants (user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS events_type_date_idx
  ON public.events (type, date);

-- -----------------------------------------------------------------------------
-- STEP 5: Backfill dancers.festival_plans -> event_participants
-- Policy: import as 'interested' and never downgrade existing 'going'.
-- -----------------------------------------------------------------------------
INSERT INTO public.event_participants (event_id, user_id, status, created_at, updated_at)
SELECT
  e.id,
  d.user_id,
  'interested'::text,
  now(),
  now()
FROM public.dancers d
CROSS JOIN LATERAL unnest(COALESCE(d.festival_plans, ARRAY[]::text[])) AS fp(event_id_text)
JOIN public.events e
  ON e.id::text = fp.event_id_text
 AND e.type = 'festival'
WHERE d.user_id IS NOT NULL
ON CONFLICT (user_id, event_id)
DO UPDATE SET
  status = CASE
    WHEN public.event_participants.status = 'going' THEN 'going'
    ELSE EXCLUDED.status
  END,
  updated_at = GREATEST(public.event_participants.updated_at, EXCLUDED.updated_at);

-- -----------------------------------------------------------------------------
-- STEP 6: Mark festival_plans as deprecated (safe staged removal)
-- -----------------------------------------------------------------------------
COMMENT ON COLUMN public.dancers.festival_plans IS
'DEPRECATED: Attendance source-of-truth moved to public.event_participants (status interested|going). Do not write new data here.';

-- Optional future step after app rollout + verification:
-- ALTER TABLE public.dancers DROP COLUMN festival_plans;

-- -----------------------------------------------------------------------------
-- Query Examples
-- -----------------------------------------------------------------------------
-- A) All festivals
-- SELECT id, name, city, date
-- FROM public.events
-- WHERE type = 'festival'
-- ORDER BY date ASC NULLS LAST;

-- B) User attending festivals (going)
-- SELECT e.id, e.name, e.city, e.date, ep.updated_at
-- FROM public.event_participants ep
-- JOIN public.events e ON e.id = ep.event_id
-- WHERE ep.user_id = :user_id
--   AND ep.status = 'going'
--   AND e.type = 'festival'
-- ORDER BY e.date ASC NULLS LAST;

-- C) User interested festivals
-- SELECT e.id, e.name, e.city, e.date, ep.updated_at
-- FROM public.event_participants ep
-- JOIN public.events e ON e.id = ep.event_id
-- WHERE ep.user_id = :user_id
--   AND ep.status = 'interested'
--   AND e.type = 'festival'
-- ORDER BY e.date ASC NULLS LAST;

-- D) Attendance counts per event
-- SELECT
--   ep.event_id,
--   COUNT(*) FILTER (WHERE ep.status = 'interested') AS interested_count,
--   COUNT(*) FILTER (WHERE ep.status = 'going') AS going_count,
--   COUNT(*) AS total_count
-- FROM public.event_participants ep
-- GROUP BY ep.event_id;
