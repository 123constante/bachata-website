# Brief: #1259 fix F6, a signed-in account with no dancer persona can hide or show anyone (BLOCKING, review r3 B1)

Repo: 123constante/bachata-admin. Branch: `claude/organiser-team-rpc` (PR #1259). Careful lane (RPC/ACL), Opus, Brief-version 3. Keep placeholder 99990101000000. Undo SQL untouched. No UI, so no INVENTORY.md; coverage = the matrix below.
Read first: `git show origin/claude/review-organiser-team-rpc-r3:docs/review/review-organiser-team-rpc-r3.md` (admin repo; push may still be finishing: fetch that branch) and your previous handover `docs/handover/organiser-team-rpc-t1.md`.

## What main lacks
In `set_organiser_team_member_hidden_v1` the caller gate is `IF NOT (_is_entity_member(...) OR _dancer_profile_id_for_account_v1(v_uid) = p_person_id)`. A signed-in account with NO dancer persona makes the second arm NULL, so `false OR NULL` is NULL, `NOT NULL` is NULL, and the IF never raises `not_allowed`. That account can hide or show any manager or listed person on ANY organiser (F5 only protects owners). On prod today 4 of 50 accounts have no persona and 119 team rows across 50 organisers are exposed (reviewer read-back). The tests miss it because every actor, including `stranger`, has a persona row.

## Do
1. Fix the gate so NULL can never pass: resolve the caller's persona ONCE into a variable and treat NULL as "not the same person"; use `COALESCE(... = p_person_id, false)` (or an explicit `IS NOT NULL AND` guard) in EVERY place the persona is compared (the self-hide arm and the F5 `owner_protected` clause, which has the same NULL shape: check it). Audit the whole function body and the read RPC for any other `NOT (a OR b)` or `<>` comparison that can be NULL, and fix each, listing them in the handover.
2. Tests (red first, run against the unfixed function by reading and by the mutant): add a `nopersona` caller (signed-in auth user with no dancer_profiles row) to the F5 matrix: hide AND show against all five targets (owner, manager, both, listed, optout) and expect `not_allowed`, with no row changed. Add a mutant in `check()` / the db test that restores the NULL-passing gate and expect red. Also add: a caller with a persona whose id equals the target (self) still works; a seatless platform admin is still refused (as reviewed).
3. DO block (`DO $verify$` self-verify in the migration): add the nopersona probe inside the existing rolled-back block so the migration refuses to apply if the hole is open.
4. Handover: update `docs/handover/organiser-team-rpc-t1.md` with the fix, the audit list, the new mutant, and the prod read-back counts the reviewer gave (counts only, read-only).

## Also fix: what the Acer run of F5 (71789e46, prove exit 4) still showed
`migration:prove --write` on the Acer: fixtures regenerate fine; the seed collision is gone, but 14 tests still fail (113 pass). Remaining failures, read them in order:
- `tests/organiserPublicTeam.db.test.ts` "every survey shape ...": expected list `['Zt1both','Zt1oldowner','Zt1owner','Zt1mgr','Zt1optout','Zt1teamonly','Zt1team2']` but `Zt1oldowner` is MISSING from the read (an owner seat whose organiser_team_members row is inactive, `oldowner`, must still be listed: see the F1 note in the test header). Probably the seed upsert (`ON CONFLICT DO UPDATE`) or the seat trigger gives `oldowner` a state the read RPC excludes. Decide by reading `organiser_public_team_v1`'s source and the seat trigger which side is wrong (the read RPC per the F1 review rule: inactive row + owner/manager seat is still listed) and fix the SMALLEST thing; the other `order:` and hide-matrix failures in that file follow from the same cause or from the seed, so re-check each after this one.
- `tests/peopleBDb3.db.test.ts` "BDB3 probe passes with no failure" got `city_required_for_review` on both Acer runs: decide by reading whether main fails identically on the same replay; if pre-existing and unrelated, say so in the handover and leave it.
The lead re-runs prove on the Acer after your push and sends a continuation if still red.

## Rules
You cannot run docker: do not run `migration:prove --write` and do not edit `tests/fixtures/rpc-bodies/` (the lead regenerates them on the Acer after your push). Source files over 2 KB through the repo's safe-edit scripts. ONE push, never add `run-ci`, never merge or approve, Supabase READ-ONLY. Last commit subject ends `[worker-done <ticket>]`.
