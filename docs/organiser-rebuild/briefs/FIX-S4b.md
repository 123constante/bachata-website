# Brief FIX-S4b -- classify AW1's two new surname readers in the surname census (admin PR #838)

Repo `123constante/bachata-admin`, branch `claude/org-r1-parity-aw1` (PR #838, head 7aa4c7b; you push this branch, ONE push at the end). Plain git (no `gh api`); shell commands without variables, loops or `$(...)`. Supabase connector READ-ONLY. Cloud worker: run `migration:prove` in your sandbox, never on the owner's PC; Docker Hub images may need retagging from `mirror.gcr.io` (see `docs/organiser-rebuild/handovers/S4-REPIN.md` on the branch).

## The failure (from the S4 re-pin handover, `docs/organiser-rebuild/handovers/S4-REPIN.md`, section FINDING)
After AW1 is merged on top of A1, `tests/surnameHidePublicly.db.test.ts` has 3 failures: `check_surname_hide_public_v1()` (rewritten by A1a section 6b, which censuses every public function that reads surname columns) returns `healthy: false` with
- `_owner_lineup_person_ok_p5(uuid,text)` -> `unclassified_surname_reader`
- `organiser_series_cast_v1(uuid)` -> `unclassified_surname_reader`
Both are AW1's new functions (file `20261126220000`). A1 classed `organiser_team_browse_people_v1` as `public_masked` but could not know about these two. The consequence if shipped: the daily/CI surname guard is RED on prod right after AW1 is applied, and nobody may trust it any more. Fix it the same way A1a section 6b did.

## What to do
1. Read A1a `20261126180000...sql` section 6b (the `DO $rw_surname$` block) and the live guard body (A1 after-body, md5 `a558b2fe2922c842702dbf2dba2be49b`) to learn the census structure and the existing CLASS NAMES. Use only an existing class; do not invent one.
2. Classify, by reading the two function bodies in `20261126220000` (do not assume):
   - `organiser_series_cast_v1(uuid)`: builds its public name through `_public_surname_v1(dp.surname, dp.hide_surname_publicly)` / `_public_display_name_v1(...)`: expected `public_masked`. Prove it by reading, and say so.
   - `_owner_lineup_person_ok_p5(uuid,text)`: internal, returns boolean, service_role only, passes `dp.surname` to `_public_person_name_v1(...) IS NOT NULL` and never returns it. Pick the existing class the guard uses for an internal/no-client-EXECUTE reader (look at how other internal helpers that read surname are classed); if the guard has no honest class for it, STOP on this one, do not weaken the guard, and report exactly what is missing.
3. Add a new section to `20261126220000` (after the existing sections, before its self-verify) that rewrites `check_surname_hide_public_v1()` from its LIVE body by the same from-live method as A1a 6b: md5 pin before (`a558b2fe2922c842702dbf2dba2be49b`, A1's after), asserted-once anchors, md5 pin after, self-verify rows. Do not edit A1's files. The new after-md5 of the guard goes into the pin table, the self-verify, and the handover. Keep every other part of the guard text byte-identical (a round trip new -> old must give A1's body).
4. Regenerate the fixture for `check_surname_hide_public_v1` with `node scripts/migration-prove.mjs --base origin/main --write`; then run WITHOUT `--write`: exit 0, all fixtures equal, 884/884 tests (or whatever the total is; the 3 surname tests green).
5. Red first: the 3 failing tests before your change are the red (paste them). Then MUTATE the fix: remove each of the two census rows in a scratch copy inside BEGIN..ROLLBACK and show `check_surname_hide_public_v1()` goes `healthy:false` naming that function (a mutant that stays green means the row does nothing: BLOCKING).
6. Re-run the other AW1 and A1 db tests on the replay (programme 76/76, organisers 38/38, organiserR1A1, organiserTeamPeopleSearch) and report counts. Nothing else in AW1 may change; every diff line beyond the new section, pins, fixture and handover must be explained.
7. Stopping rule: this is a guard-classification change proved by a red test plus mutants. It gets NO further review round; the orchestrator reads your handover and the green checks.

## Report
Handover `docs/organiser-rebuild/handovers/FIX-S4b.md`: the classification reasoning per function, old -> new guard md5, red/green evidence, mutation table, the per-job checks table (read `.github/workflows`; say which could not run), the FINAL after-md5 of every function in `20261126220000` and `20261126230000` that you touched (a second session builds on them), Verified / Not verified. ONE push; last commit subject ends `[worker-done <ticket>]` (PARTIAL if cut short). Stay under 30% context; at 25% start nothing new.
