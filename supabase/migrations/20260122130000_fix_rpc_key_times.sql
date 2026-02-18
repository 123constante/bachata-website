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
    -- Return key_times as jsonb (handle text to jsonb cast)
    CASE 
      WHEN e.key_times IS NULL OR e.key_times = '' THEN NULL
      ELSE e.key_times::jsonb 
    END as key_times,
    e.type,
    
    -- Extract Party Flag from both possible locations
    COALESCE(
      (e.meta_data #>> '{key_times,party,active}')::boolean, 
      (CASE WHEN e.key_times IS NOT NULL AND e.key_times != '' THEN (e.key_times::jsonb #>> '{party,active}')::boolean ELSE false END),
      false
    ) as has_party,
    
    -- Extract Class Flag from both possible locations
    COALESCE(
      (e.meta_data #>> '{key_times,classes,active}')::boolean, 
      (CASE WHEN e.key_times IS NOT NULL AND e.key_times != '' THEN (e.key_times::jsonb #>> '{classes,active}')::boolean ELSE false END),
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
    ) as instance_value
  WHERE
    e.is_active = true
    AND instance_value >= range_start
    AND instance_value <= range_end;
$$;
