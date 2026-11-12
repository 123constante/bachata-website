# Fix red contract-check on main

Repo: 123constante/bachata-website. Branch: claude/fix-contract-check-main. Lane: careful.
Evidence: main runs 43219361438 and 43219346431, job contract-check, step "Run P5 occurrence materialised canonical check" (scripts/check-occurrence-p5-materialised-canonical.mjs, workflow .github/workflows/db-contract-check.yml).

## Diagnosis
Check fails: `drift_count=51 (date_drift=0, time_drift=51)`. event_occurrence_p5.materialised_start_utc differs from the local-as-UTC stash, e.g. series f43ef36f... expected 2026-12-10T19:15Z, materialised 19:00Z (15 min off; a festival row is 6 h off). Legacy corroboration arm is retired (M5 Stage E C8b, 20261107700000), so the check now bites on real prod data drift, not a types file. Find whether the cause is (a) stale materialised rows after a default_local_start_time change on series, or (b) the stash function/materialiser using the wrong time source (e.g. series default vs per-occurrence override).

## Fix steps
1. Read the script and the stash_local_as_utc definition in supabase/migrations; reproduce read-only with the Supabase MCP (SELECT only) and classify the 51 rows (festival vs not, future vs past, by series).
2. Decide the correct side: if the materialiser logic is wrong, fix via a migration PR (replay proof, careful lane); if rows are stale, write a migration that re-anchors via stash_local_as_utc(occurrence_date, default_local_start_time) for drifted rows only. Do not loosen the check.
3. State a written prediction of the row count before/after in the PR.

## Acceptance
- contract-check job green on the PR branch (every step run, incl. P5 materialised canonical check, drift_count=0).
- No other job newly red vs main. Table-driven test or check covering the drift classes found.
- PR has Verified / Not verified block and per-job CI table.

## Constraints
NO prod writes by the worker. Any data repair ships as a migration PR applied later by the lead under the standing migration approval. Read-only SQL only.
