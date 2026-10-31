# Handover: P3 create-event mockups, round 2

## Done
- Removed the event-level Start / Ends (and "Ends the next day") from every phone in A, B, C. The times are asked once, as the FIRST SESSION's start and end, inside What happens (A sheet, B step 3, C row/sheet). Event time elsewhere is read-only, "from your sessions".
- Regenerated a/b/c/index via `build.py`. Comparison table and design record updated: "No end time" gap replaced by "times live on sessions".

## Data-source answer (read-only prod `stsdtacfauprzrdebmzg`)
Displayed time = `event_occurrence_p5.materialised_start_utc/_end_utc`, written by `_recompute_occurrence_headline_time_from_sessions_v1` from the sessions (first start to last end). Series `default_local_start_time` / `default_duration` are trigger-synced defaults. Session rows hold `start_time`, `end_time`, `section_kind`. Old wizard wrote `default_local_start_time` only.

## Left
- Not verified: the exact add-session command in `series_command_p5` that accepts times at create (flagged in the record).
- Not verified: pixel/tap-size check in a browser; edits reuse existing 44px classes. Empty-state copy for "no session has a time" is not drawn as its own phone.
