# Fix brief F-A1 -- one fix pass on admin PR #834 (A1a + A1b) after the independent review

Repo `123constante/bachata-admin`, branch `claude/org-r1-admin` (EXISTS, PR #834, head `99f4eefb`; you are the ONLY worker on it), base `main`. You are the author's fix worker, not a reviewer. Plain git only (no `gh api`); write shell commands without variables, loops or `$(...)`. Supabase connector is READ-ONLY on prod; the E2E project `srrpvuxldthwumzrngla` is the only place a probe may run (always-raising single statement so it rolls back; never leave rows). The migrations are GENERATED: change the generator inputs under `scripts/migration-generators/organiser-r1-a1/` and rebuild both files (`python3 build_a1a.py`, `python3 build_a1b.py`); never hand-edit a migration. The migration versions stay `20261126180000` and `20261126190000`.

READ FIRST: the brief `A1-admin.md`, your handover `docs/organiser-rebuild/handovers/A1.md`, and the FULL review: `git fetch origin claude/org-r1-review-A1` then `git show FETCH_HEAD:docs/organiser-rebuild/reviews/REVIEW-A1.md`. Website briefs live in the Website repo (`git remote add web https://github.com/123constante/bachata-website.git`, `git fetch web arc/briefs-organiser-r1`).

## Do (all from the review table; RED first where a test is involved, paste failing output)
1. **B1.** `git rm --cached` the `.pyc`; add `__pycache__/` and `*.pyc` to `.gitignore`.
2. **B2.** CI `prove` is red: 8 stale fixtures in `tests/fixtures/rpc-bodies/`. Run `npm run migration:prove -- --write` if the sandbox has Docker/Postgres; commit the 8 fixtures (the 10 "new" ones too if the tool writes them). If it cannot run here, say so in the handover as NOT VERIFIED and name the exact command for the orchestrator; do not hand-write fixtures.
3. **B3.** `occurrence.move_date` refuses a festival date (`format='festival' OR festival_id IS NOT NULL`) with a clear error code, as `_cmd_occurrence_set_time_p5` does. Add a probe step: a festival occurrence is refused and its instant is unchanged. RED first against the unfixed generator output.
4. **B4.** Probe step: a `contributor` member calling `organiser_team_browse_people_v1` gets `not_authorised`. Re-run mutant M3 (gate reduced to `v_caller IS NULL`) and show it RED.
5. **B5.** Probe: seed one visible dancer with a blank `avatar_url`; assert absent from browse. Re-run mutant M4 (photo filter removed) and show it RED.
6. **S1.** Fix the A1a header line about `check_self_serve_contract_v1` and record "not re-pinned: no arm reads the edited text" in the handover.
7. **S2.** Take `pg_advisory_xact_lock(hashtextextended('org_name:' || key, 0))` before the name check in create. **S3.** Raise `name_invalid` when the name key is `''`. **N4:** use `[^[:alnum:][:space:]]+` for the key if the brief's intent is "punctuation ignored" (check R3-10; else leave and say why).
8. **S4.** Move the 20-member cap into the shared member-insert path (`_organiser_member_set_p5`) and the invite-redeem path, under the same organiser lock. Probe: the 21st member via email and via invite is refused.
9. **S5.** Keep the code `draft_limit_reached` (owner default: renaming breaks the pinned Website mapping). State in the PR body/handover as a HARD merge-train step: apply A1b only right before Website R1 merges.
10. **N1.** Use the same `CROSS JOIN LATERAL` shape as `_organiser_team_people_p5` for `account_problem` in browse. **N2:** bump the series `version` in move_date when it writes `removed_dates` (or document the lock argument and keep). Others: no change.
11. Do NOT touch anything else; re-pin md5s only where a function you changed is pinned, and say which.

## Tests and CI
Re-run both probes on E2E (`A1A_RESULT`, `A1B_RESULT` with pass/fail counts), `npx vitest run tests/organiserR1A1.db.test.ts`, `node scripts/migration-prove.mjs --base origin/main --static-only`, the generators byte-identical check (`git status` clean after a rebuild), and every step of the admin workflows you can run. Per-job table with exit codes in the handover. GitHub Actions refused with a payments annotation is not a code failure.

## Output
ONE push of `claude/org-r1-admin` at the end. Last commit subject ends `[worker-done <ticket>]` (or `PARTIAL [worker-done <ticket>]` at 25% context; a continuation worker is normal and reads `handovers/A1.md`). Report head SHA and a Verified / Not verified.
