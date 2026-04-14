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
  meta_data jsonb,   -- <--- ADDED THIS (Critical for flags)
  type text          -- <--- ADDED THIS (Critical for filtering)
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
    e.type
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
