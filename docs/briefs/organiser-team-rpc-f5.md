# Brief: #1259 fix F5, a manager can never hide (or un-hide) an owner

Brief-version: 1
Branch: claude/organiser-team-rpc (admin, PR #1259). Lane: careful (RPC/ACL). Model: Opus. The fixture worker ended NOT RUN (no docker in its sandbox); the lead regenerated fixtures on the Acer and found two test failures, see "What the Acer run showed" at the end. Do NOT run `--write` and do NOT edit tests/fixtures/rpc-bodies/ (CI or the lead regenerates them after your push). The lead folds this into #1259 and then runs ONE run-ci. One push. No placeholder rename (keep 99990101000000). Undo SQL untouched.
Owner decision 2026-11-05 (click): "Owners and admins only" may hide an owner. A manager can hide listed people and other managers, never an owner.

## Goal (four lines)
1. Who: organiser owners and managers; visitors of the public Team list.
2. After: a manager cannot remove an owner from the public Team; an owner (or platform admin if `_is_entity_member` already admits one) can; a person can still hide themself.
3. Worked if: every caller x target pair behaves as the matrix below, with typed refusal and plain-words HINT; the verify block and a mutant prove it.
4. Limits: only `set_organiser_team_member_hidden_v1` body and its tests/handover change; no ACL change (authenticated only stays); read RPC unchanged.

## What main lacks
- the hide RPC lets any owner/manager hide anyone -- grep: `_is_entity_member('organiser', p_organiser_profile_id, v_uid, ARRAY['owner', 'manager'])` in supabase/migrations/99990101000000_organiser_public_team_v1.sql (inside set_organiser_team_member_hidden_v1)
- no "manager cannot touch an owner" refusal code -- grep: not_allowed (only the generic one exists)

## The clause
After the existing allowed check and the person_not_on_team check, before the INSERT/DELETE, add:
raise `owner_protected` (ERRCODE 42501, HINT 'Only an owner can hide or show an owner.') when ALL hold:
- the target person holds an owner seat on this organiser (an `entity_members` row with member_role = 'owner' whose `_dancer_profile_id_for_account_v1(user_id)` = p_person_id);
- the caller holds NO owner seat on this organiser (`NOT public._is_entity_member('organiser', p_organiser_profile_id, v_uid, ARRAY['owner'])`);
- the caller is not acting on themself (`_dancer_profile_id_for_account_v1(v_uid) <> p_person_id`).
Applies to BOTH hide and show (p_hidden true and false). If `_is_entity_member` already treats a platform admin as passing, keep that (state in the handover how admin is treated; do not widen it). Update the COMMENT ON FUNCTION text and the header paragraph 3 (allowed list), and add the new code to the list of typed refusals the Website maps (the Website P2 brief reads this list).

## Matrix the test must cover (caller x target; hide AND show)
| Caller \ Target | owner | manager | listed |
|---|---|---|---|
| owner | ok | ok | ok |
| manager | owner_protected | ok | ok |
| self (person themself, any seat) | ok | ok | ok |
| admin (if admitted by `_is_entity_member`) | ok | ok | ok |
| listed-only, stranger, signed-out | not_allowed / not_signed_in as today | same | same |
Include: owner who is ALSO a manager on one account; a manager who is also listed; an owner hiding themself; a manager un-hiding an owner hidden earlier by an owner (refused).

## Verify + mutant
- Add to `DO $verify$`: a static check that the function body contains the clause is NOT acceptable; instead assert behaviour inside a rolled-back block, or keep the DB test as the proof and say so in the handover. The lead must know which.
- Add a mutant in `tests/organiserPublicTeam.db.test.ts` that drops the clause (replace the new IF with `IF false`) and expect the matrix test to go red (`owner_protected` case).
- Keep the existing four mutants and the F1 mutant green.

## What the Acer run showed (2026-11-05, `npm run migration:prove -- --write` at head 8dbc30c5, exit 4)
Fixtures regenerated fine. Then the tests naming the changed functions failed:
1. `tests/organiserPublicTeam.db.test.ts`: 35 of 36 fail at the first seed with `duplicate key value violates unique constraint "uq_organiser_team_member"` (helper `tx`, the INSERT INTO organiser_team_members loop). Probable cause: a trigger on entity_members (or organiser_profiles) already creates organiser_team_members rows for owner/manager seats on the replayed schema, so the explicit INSERT collides. Find it (grep organiser_team_members in supabase/migrations), then make the seed idempotent (ON CONFLICT DO UPDATE to the wanted is_active/sort_order) with the matrix unchanged. Never weaken an assertion.
2. `tests/peopleBDb3.db.test.ts` "BDB3 probe passes with no failure" got `city_required_for_review`. Check by reading whether main fails the same way on the same replay. If pre-existing and unrelated, say so in the handover and do NOT touch it; if this branch causes it, fix it.
You cannot run these (no docker). Fix by reading the schema; the lead re-runs prove on the Acer and sends a continuation if it is still red.

## Standing lines
- Source files over 2 KB through scripts/safe-edit.py or safe-write.py. Read the live body of `_is_entity_member` first (prod, project stsdtacfauprzrdebmzg, read-only) and state in the handover how it treats admins and which roles it accepts.
- Push once, never add `run-ci` yourself, handover note updated (`docs/handover/organiser-team-rpc-t1.md`), `[worker-done <ticket>]` on the final commit, stop. At 40% context stop with PARTIAL and a "what is left" list.
