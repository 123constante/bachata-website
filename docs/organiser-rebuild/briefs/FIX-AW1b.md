# Fix brief FIX-AW1b -- the FINISHING pass on claude/org-r1-parity-aw1 (admin PR #838)

Repo `123constante/bachata-admin`. Push ONLY `claude/org-r1-parity-aw1` (head bdddaa5a; no other worker on it). ONE push at the end (plus a PARTIAL push if cut short). Plain git, never `gh api`; shell commands without variables, loops or `$(...)`. Opus, xhigh. Under 30% context: at 25% start nothing new; by 30% push + handover `docs/organiser-rebuild/handovers/AW1-fix2.md`, last subject `PARTIAL [worker-done <ticket>]`. Supabase READ-ONLY (SELECT, counts only). Run every CI job step you can in your sandbox, per-job table (command + exit) in the handover. Final commit subject ends `[worker-done <ticket>]`. This is the last round: no further review; be exact.

Read first: `docs/organiser-rebuild/reviews/REVIEW-AW1b.md` on branch `claude/org-r1-review-AW1b` (the findings, with probes P1-P6 and the proposed fixes), and `docs/organiser-rebuild/handovers/AW1-fix.md` on the branch.

Edit the two unapplied migration files in place (`20261126220000`, `20261126230000`); keep their versions; no new files.

## Required

### B-1 (BLOCKING) day parking overflows a date in the item trigger (22008)
The parking `UPDATE` at `20261126220000...sql:~501` parks days at `-2000000000 + rn`; `trg_p5_sync_series_default_times` -> `_p5_occurrence_program_end_v1` computes `occurrence_date + date_offset_days` and raises 22008 for a multi-day programme with a scheduled occurrence dated today or later (6 future festivals on prod). Fix: park on small negative keys no real day uses (`day_index = -1 - r.rn`, `date_offset_days = -1 - r.rn`; prod's real range is 0..5). Check both UNIQUE keys cannot clash with real keys. Tests, RED first against the current head (paste the reds): festival with 2 timed days and 1 FUTURE occurrence: untouched re-save with ids, reversed-day re-save, drop-a-day, and a no-ids save by an admin all succeed; assert `default_local_start_time`, `default_duration` and `materialised_end_utc` equal what `main`'s handler gives for the same input; ids, `created_at`, `legacy_program_item_id` kept; offsets come back 0 and 1. Also a recurring 2-day series with an owner payload of day 0 only. Mutant: restore the old parking value -> these go red.

### S-1 (SHOULD) guard against an id-less save wiping overrides (transition hazard)
In `_cmd_series_set_program_p5`, after the id checks: refuse for EVERY caller when ALL hold: the payload carries at least one item; it carries no programme id at any level; the series has at least one stored item referenced by `event_occurrence_session_override_p5`. Text exactly: `invalid_payload: this programme save carries no ids but the series has per-date changes; reload the editor and save again`. No force flag. `{days: []}` carries no items so it is NOT caught (admin can clear on purpose; owner still hits the delete-with-override refusal). Tests RED first: admin id-less payload with items on a series with an override is refused and nothing changes (override still there); `{days: []}` still passes for an admin; an id-less save on a series WITHOUT overrides still works; mutant: drop the guard -> red.

### N-2 (NOTE, do it) defence in depth
After each upsert `UPDATE ... WHERE id = v_day_id / v_section_id / v_item_id`, `IF NOT FOUND THEN RAISE EXCEPTION 'invalid_payload: a programme id does not belong to this series'`.

### N-1 follow-up
The drop-a-day test must assert the end values (default times and materialised end) so the mid-save caveat stays covered.

### Pins and fixtures (do last)
The handler md5 changes: re-pin `c_h_after` and every after-md5 that embeds it in both files, regenerate the 9 fixtures with `migration:prove --write` (exit 0), rerun both db tests (all green), tsc, `check:integrity`, the converter unit tests.

### Handover
`AW1-fix2.md`: what changed, the red-first pastes, mutants, per-job CI table, Verified / Not verified, and the unchanged S-4 note (A1 merges first; the re-pin list in AW1-fix.md still applies; the md5s you computed here are the new after-pins).

Do not touch unrelated files.
