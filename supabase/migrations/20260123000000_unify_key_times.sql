-- Migration: Unify key_times source of truth
-- 1. Backfill: Copy key_times from meta_data to the root key_times column
-- This ensures existing events like "Mock Party" are accessible via the standard column.
UPDATE events
SET key_times = (meta_data->'key_times')::text
WHERE (key_times IS NULL OR key_times = '') 
  AND meta_data ? 'key_times';

-- 2. Cleanup: Remove key_times from meta_data to prevent confusion (Single Source of Truth)
UPDATE events
SET meta_data = meta_data - 'key_times'
WHERE meta_data ? 'key_times';

-- 3. Update RPC to strictly use the root key_times column
-- Must DROP first because we are changing the return key_times from maybe-text to explicit jsonb
DROP FUNCTION IF EXISTS get_calendar_events(text, text);

CREATE OR REPLACE FUNCTION get_calendar_events(
  range_start text, 
  range_end text
)
RETURNS TABLE (
  event_id uuid,
  name text,
  photo_url text[],
  location text,
  instance_date text,
  start_time text,
  end_time text,
  is_recurring boolean,
  meta_data jsonb,
  key_times jsonb,
  type text,
  has_party boolean,
  has_class boolean
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    e.id as event_id,
    e.name,
    ARRAY[e.photo_url::text] as photo_url,
    e.location,
    instance_value as instance_date,
    e.start_time,
    e.end_time,
    (jsonb_array_length(e.instances) > 1) as is_recurring,
    e.meta_data,
    -- Use the safe cast from the Lateral join
    k.safe_key_times as key_times,
    e.type,
    
    -- Extract Party Flag PURELY from the safe key_times
    COALESCE(
      (k.safe_key_times #>> '{party,active}')::boolean, 
      false
    ) as has_party,
    
    -- Extract Class Flag PURELY from the safe key_times
    COALESCE(
      (k.safe_key_times #>> '{classes,active}')::boolean, 
      false
    ) as has_class
  FROM
    events e,
    jsonb_array_elements_text(
      CASE 
        WHEN e.instances IS NULL OR jsonb_array_length(e.instances) = 0 
        THEN jsonb_build_array(e.start_time)
        ELSE e.instances 
      END
    ) as instance_value,
    -- LATERAL JOIN for safe casting: Prevents crashes on empty strings or nulls
    LATERAL (
      SELECT CASE 
        WHEN e.key_times IS NULL OR e.key_times = '' OR e.key_times = 'null' THEN '{}'::jsonb
        ELSE e.key_times::jsonb 
      END as safe_key_times
    ) k
  WHERE
    e.is_active = true
    AND instance_value >= range_start
    AND instance_value <= range_end;
$$;
