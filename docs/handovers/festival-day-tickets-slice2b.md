# Handover: festival-day-tickets-slice2b (BLOCKED, no code change)

Done: read the brief and the LIVE prod bodies (pg_get_functiondef, read-only) of
ticket_check_in_v3, ticket_check_in_by_code_v3, ticket_check_in_by_id_v3, ticket_door_list_v3.

BLOCKER: all four begin with
  IF NOT EXISTS (SELECT 1 FROM event_occurrence_p5 n WHERE n.id = p_occurrence_id AND n.series_id = p_event_series_id)
  THEN RETURN wrong_night
With p_occurrence_id = NULL that is always true, so every call returns `wrong_night`.
The brief says "pass null, the server picks the door day": the live functions do NOT do that.
DoorScreen has no occurrence/night today (only seriesId from the route), so a straight
contract swap would make the door refuse every ticket and show an empty list.

Needs owner/admin decision, either:
 (a) admin-repo fix: v3 treats NULL occurrence as "pick the door day" (what the brief assumes), or
 (b) Website resolves an occurrence id (needs a read of event_occurrence_p5 for the series and a rule for which night), which contradicts "do not add a night picker".

Left: mapping edits in data.ts (v1->v3 names + p_occurrence_id), model.ts/DoorScreen results
wrong_day / add_on_not_admission / unclassified_festival_type, tests, types.ts v3 entries, e2e route mocks (tests/e2e/*door*).
Next: once (a) or (b) is decided, apply the brief as written.
Not verified: everything (no code changed); tsc not run.
