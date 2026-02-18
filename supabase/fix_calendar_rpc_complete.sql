-- COMPREHENSIVE FIX: Column + Function + Permissions
-- Run this entire script in the Supabase SQL Editor

-- 1. Ensure 'city_slug' column exists (safe to run multiple times)
ALTER TABLE events ADD COLUMN IF NOT EXISTS city_slug text;

-- 2. Drop ambiguous functions to ensure clean slate
DROP FUNCTION IF EXISTS get_calendar_events(text, text);
DROP FUNCTION IF EXISTS get_calendar_events(text, text, text);

-- 3. Create the robust function with city filtering
CREATE OR REPLACE FUNCTION get_calendar_events(
  range_start text, 
  range_end text,
  city_slug_param text DEFAULT NULL
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
  has_class boolean,
  city_slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
    
    -- Extract Party Flag
    COALESCE(
      (k.safe_key_times #>> '{party,active}')::boolean, 
      false
    ) as has_party,
    
    -- Extract Class Flag
    COALESCE(
      (k.safe_key_times #>> '{classes,active}')::boolean, 
      false
    ) as has_class,

    e.city_slug
  FROM
    events e,
    jsonb_array_elements_text(
      CASE 
        WHEN e.instances IS NULL OR jsonb_array_length(e.instances) = 0 
        THEN jsonb_build_array(e.start_time)
        ELSE e.instances 
      END
    ) as instance_value,
    LATERAL (
      SELECT CASE 
        WHEN e.key_times IS NULL OR e.key_times = '' OR e.key_times = 'null' THEN '{}'::jsonb
        ELSE e.key_times::jsonb 
      END as safe_key_times
    ) k
  WHERE
    e.is_active = true
    AND instance_value >= range_start
    AND instance_value <= range_end
    AND (
        city_slug_param IS NULL 
        OR e.city_slug = city_slug_param
    );
$$;

-- 4. Grant permissions to everyone
GRANT EXECUTE ON FUNCTION get_calendar_events(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_calendar_events(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_calendar_events(text, text, text) TO service_role;
