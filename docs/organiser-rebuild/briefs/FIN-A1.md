# Brief FIN-A1 -- ONE finishing pass on admin PR #834 (A1), TESTS ONLY

Repo `123constante/bachata-admin`, branch `claude/org-r1-admin` (PR #834, head ad1f773; you push this branch, ONE push at the end). Plain git (no `gh api`); shell commands without variables, loops or `$(...)`. Supabase connector READ-ONLY. Docker Hub images may need retagging as F-A1c did (see `docs/organiser-rebuild/handovers/A1.md`); you are a cloud worker, never run anything on the owner's PC.

Source: the round-2 review `docs/organiser-rebuild/reviews/REVIEW-A1b.md` on branch `claude/org-r1-review-A1b` (fetch it). It is the LAST review round: you fix its findings, you do not start a new review.

## HARD RULE: do NOT change either migration SQL file or any function body
The md5 pins (A1 after-md5s `apply_aggregate_write_p5` 683146b0ba27264ddb2f004cdebcdf3d, `check_owner_command_allowlist_v1` 374c268853f50704ea216b01a2c6ebc4, and every fixture in `tests/fixtures/rpc-bodies/`) are now the input to the AW1 re-pin worker and to a second session's migrations. Your diff must be TESTS ONLY (plus the handover). If a finding cannot be fixed without touching SQL, do NOT touch SQL: write it under "Left" in the handover and stop on that item. `migration:prove` (no `--write`) must still say all 21 fixtures match, and `git diff origin/claude/org-r1-admin -- supabase/migrations tests/fixtures` must be empty at the end.

## Fix list (red-first for each: show the new test FAIL against the mutant, PASS against the real body)
1. **NB1**: `tests/sql/organiser-r1-a1a.contract.sql`: a probe with a series whose `format` is a NON-festival format (e.g. `'recurring'`) and `festival_id` is SET: `occurrence.move_date` is refused (`invalid_payload ... festivals`), the date and `materialised_*` instant unchanged. Mutant to prove: drop the `OR s.festival_id IS NOT NULL` arm in a scratch copy inside BEGIN..ROLLBACK -> the probe goes RED.
2. **NB2**: a two-session vitest under `MIGRATION_PROVE_DB_URL`, in the pattern of `tests/adminAddEntityMemberOwnerLock.test.ts`: session A creates organiser "X Club" and holds its transaction; session B creates "X Club &&" (same name key, different slug); assert B gets `organiser_name_taken` (not a raw 23505 on `organiser_profiles_slug_uidx`) and exactly one row exists. Mutant: remove the `pg_advisory_xact_lock(... 'org_name:' ...)` line in a scratch copy -> RED. Skip cleanly (not fail) when no DB URL, like the sibling test; it must RUN inside `migration:prove`.
3. **NS1**: contract M-block: the series `version` is +1 after a successful `move_date` and unchanged after a same-date no-op. Mutant: drop the bump -> RED.
4. **NS2**: contract K-block: on a 20-member page the owner changes a contributor to manager through `organiser_team_set_member_v1`: ok, member count stays 20. Mutant: apply the cap on role changes -> RED.
5. **NN1**: either add a login the browse join would drop (one `_member_target_account_p5` returns no row for) with an assertion, or write one sentence in the handover that the mutant is equivalent while that function returns exactly one row per login. Pick whichever is cheaper.
6. **NN2 / NN3 / NN5 / NN6**: do NOT fix; list them in the handover under "Left for the orchestrator" (NN2 is a comment inside a function body = SQL, forbidden here).

## Checks you must run and report (per job, with command and exit code)
`node scripts/migration-prove.mjs --base origin/main` (exit 0, all fixtures equal, test count), the two contract probes (A1A and A1B pass counts), the generators byte-identical (`python3 build_a1a.py` then `python3 build_a1b.py`, tree clean), and read `.github/workflows` for any job the changed test files feed. GitHub checks on #834 are green on ad1f773; you cannot see the new head's.

## Output
Handover `docs/organiser-rebuild/handovers/FIN-A1.md`: per item red/green evidence, mutation table, checks table, Verified / Not verified, Left. ONE push; last commit subject ends `[worker-done <ticket>]` (PARTIAL if cut short). Stay under 30% context; at 25% start nothing new.
