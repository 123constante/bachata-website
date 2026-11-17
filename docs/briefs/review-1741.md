# Review of Website PR #1741 (festival day tickets slice 2b): door screen on v3 functions

Repo 123constante/bachata-website. PR #1741, branch claude/festival-day-tickets-slice2b, head 8927a0e18203b288bdedfd9c9b0deb1ac598ddc2 (fetch, confirm the sha; if it moved, review the new head and say so). Builder handover: docs/handovers/festival-day-tickets-slice2b.md.

Change: src/modules/organiser/p3/door/{data,model,types}.ts and DoorScreen.tsx move the door from ticket_check_in_v1/by_code/by_id/door_list v1 to the v3 functions with `p_occurrence_id: null` (server picks the series' earliest not-ended night; live since admin PR #1945). Last commit is a types.ts regen only (types-drift fix).

Decide (door check-in is a permission/safety surface; the failure to catch is LETTING IN someone who should be refused):
1. Every v3 refusal value (wrong_night, wrong_day, add_on_not_admission, unclassified_festival_type, refunded, void, any unknown) maps to a refusal in parseCheckIn/RESULT_TABLE, never to LET IN. Unknown/missing fields default to refuse.
2. Arg names and shapes match the live v3 signatures in src/integrations/supabase/types.ts (p_occurrence_id nullable, p_event_series_id etc.).
3. Anywhere v1 is still called on the door path (grep door_v1 / ticket_check_in_v1 / ticket_door_list_v1): list them.
4. DoorScreen wrong_night list card: Back to scanning works, no scan loop, no load-error regression.
5. Copy plain and warm (see tests/matrix for wording).

Do: read, grep, run only light checks (no installs, no full test suite). Do not edit the PR branch, merge, approve or apply anything.

Output: docs/review/pr-1741.md on your own branch with separate lines `## Verdict: PASS` (or PASS WITH NITS or BLOCK) and `## Hard-tier: PASS` (or FAIL with reason), findings with file:line, Not verified list. Push, open a bot-authored PR, stop and report.
