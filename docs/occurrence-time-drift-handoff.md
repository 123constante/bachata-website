# Handoff: occurrence-time drift (DB data regression)

> For a FRESH session. Paste this in, plus: "read CLAUDE.md and the
> `project_occurrence_date_integrity_arc` memory before starting."

## Problem
`db-contract-check` CI is RED due to live-database occurrence times drifting from
their canonical program. This is a DATA regression, not a code bug, and it is
PRE-EXISTING on `main` (failing on every push since at least 2026-06-15). It is
NOT caused by SEO PR #60.

## Exact failures (CI run 27596170041, 2026-06-16)
- occurrence instance_time canonical -> DRIFT 306/1643 occurrences: instance_start/end
  disagree with the canonical program join.
- occurrence instance_END canonical -> 287/1624 occurrences: instance_end disagrees
  (start+24h or stale-day smell).
- occurrence integrity aggregator -> 593 total drift; invariants above baseline:
  instance_time_canonical, instance_end_canonical.
- program editor Phase 0 schema check -> 3 actionable sections have items but no row
  in event_program_section_rooms (strict-zero after the 2026-05-13 contract
  narrowing; "actionable" = event venue has venue_rooms). SEPARATE sub-issue.

## Key context
- DB: Supabase project stsdtacfauprzrdebmzg (shared by both repos).
- The "Occurrence Date Integrity arc" was CLOSED 2026-06-09 at 0 drift (self-heal +
  recompute triggers + health checks). So a regression REINTRODUCED drift AFTER
  2026-06-09 -- likely a recent merge (search v5 #58, M1 session-people parity, or
  festival multi-day work). Find what regressed; do not just paper over it.
- CI log fix hints:
  - Mechanical drift -> public.self_heal_occurrence_integrity_v1()
  - Per row -> public.recompute_occurrence_times_v1(<occurrence_id>)
  - "If many rows drifted at once, suspect a regression in the canonical -> UTC
    mapping (tz extraction, midnight-cross arithmetic, or the trigger). See admin
    migrations 20260623070000 / 20260623080000 / 20260623090000."
  - P5 <-> legacy DATE-direction mismatches are a HUMAN decision, not auto-healable.

## Constraints (CLAUDE.md)
- This Website repo owns the CHECK SCRIPTS (scripts/check-*.mjs,
  .github/workflows/db-contract-check.yml) but ZERO migrations.
- Migration/DDL authority lives in bachata-admin-11april/supabase/migrations/
  (applied via `supabase db push`). Supabase MCP available for read + repair
  (confirm-before-mutate).

## Suggested first-session sequence
1. Reproduce: read db-contract-check.yml for exact script names, run the occurrence
   checks (node scripts/check-*.mjs) to see current live drift count.
2. Diagnose BEFORE healing: inspect a few drifted occurrences (recompute expected vs
   actual); check whether the recompute TRIGGER still fires. If healing then
   re-drifts, a trigger/mapping regressed.
3. Identify the regressing change: diff what merged after 2026-06-09 touching
   occurrence / program / timezone logic.
4. Repair data with self_heal_occurrence_integrity_v1(); fix root cause via an
   admin-repo migration if a trigger/mapping broke; re-run checks to 0 drift.
5. Separately fix the 3 sections missing event_program_section_rooms rows
   (program editor schema check #6).

## Verify
Re-run db-contract-check (the occurrence checks #20 instance_time, #28 instance_END,
#30 integrity aggregator, #6 program editor schema) until 0 drift / green.
