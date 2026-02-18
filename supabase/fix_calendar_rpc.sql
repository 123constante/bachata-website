-- Run this in the Supabase SQL Editor to fix the "No events found" issue
-- This setting (SECURITY DEFINER) allows the function to read events even if the user isn't logged in
ALTER FUNCTION get_calendar_events(timestamp with time zone, timestamp with time zone, text) SECURITY DEFINER;

-- Grant functionality to all users
GRANT EXECUTE ON FUNCTION get_calendar_events(timestamp with time zone, timestamp with time zone, text) TO anon;
GRANT EXECUTE ON FUNCTION get_calendar_events(timestamp with time zone, timestamp with time zone, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_calendar_events(timestamp with time zone, timestamp with time zone, text) TO service_role;
