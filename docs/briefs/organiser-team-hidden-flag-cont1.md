# Brief: organiser-team-hidden-flag continuation 1 (admin, CAREFUL, test fix only)

Brief-version: 2
Repo: admin (123constante/bachata-admin). Branch: claude/organiser-team-hidden-flag (PR #1270, head 203f25d2, real version 20270315210000 already assigned). Lane: careful, Opus. NO new database change.

## What main lacks
- tests/organiserTeamHidden.db.test.ts fails 10 of 40 in `migration:prove --write` (Fixture regen run 42170356559, nothing pushed). Every failure has ONE cause: the seed `hideAs('owner', 'teamonly', true, 'org2')` in `check()` (around line 160) and in the "hidden on org2 only" shape test (around lines 271-279) calls the hide RPC as `owner`, but `owner` only holds seats on `org` and `draft`, never on `org2`, so the RPC correctly answers `not_allowed`. The RPC is right; the test seed is wrong. -- tests/organiserTeamHidden.db.test.ts
- extends: the `seats` list in `tx()` (around line 97) is where `org2` needs an owner seat. -- tests/organiserTeamHidden.db.test.ts

## Files
tests/organiserTeamHidden.db.test.ts (new on this branch, not yet on main) only, plus docs/handover/organiser-team-hidden-flag-cont1.md (new). Touch no migration, no fixture by hand.

## What to build
1. RED first: run the test as is and confirm it fails with `seed hide owner -> teamonly: not_allowed`.
2. Fix the seed: give the seeded org2 an owner seat for a caller that is allowed to hide there (add `['owner', 'org2', 'owner']` to `seats`, OR hide on org2 as a dedicated `owner2` caller). Check the other 30 passing tests stay green: they must not change meaning (a seat on org2 for `owner` must not make any "owner on org only" assertion lie; re-read each test that lists what `owner` can see).
3. Run the whole file locally if Docker is available; if not, say so under Not verified and rely on one CI run.
4. Push ONCE. The lead then adds the `run-ci` label; Fixture regen will push the regenerated fixtures itself (never run `--write` yourself).

## Out of scope
The migration, the RPC, fixtures by hand, any other test file.
Hand-off: Verified / Not verified block in the handover file.
