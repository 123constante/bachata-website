-- Run this to fix permissions (Updated with correct signature)
-- The function likely accepts (text, text, text) because the inputs are ISO strings
ALTER FUNCTION get_calendar_events(text, text, text) SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_calendar_events(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_calendar_events(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_calendar_events(text, text, text) TO service_role;
