# Brief F-A1b -- regenerate the A1 RPC-body fixtures (review B2), nothing else

Repo `123constante/bachata-admin`, branch `claude/org-r1-admin` (EXISTS, PR #834, head `4c66b4d`; you are the ONLY worker on it), base `main`. Plain git only (no `gh api`); write shell commands without variables, loops or `$(...)`. Supabase connector is READ-ONLY. Do NOT touch the migrations, generators, probes or anything but `tests/fixtures/rpc-bodies/`, `docs/organiser-rebuild/handovers/A1.md`.

READ FIRST: `docs/organiser-rebuild/handovers/A1.md` (section on B2) on your branch. Brief files live in the Website repo (`git remote add web https://github.com/123constante/bachata-website.git; git fetch web arc/briefs-organiser-r1`).

## Why
CI `prove` is red: 8 stale fixtures in `tests/fixtures/rpc-bodies/` (plus `_organiser_member_set_p5` and `redeem_organiser_invite_v1`, rewritten by A1b). The previous worker's sandbox could start Docker but every Supabase image pull failed (`Data limit exceeded` / CloudFront 403). Fixtures must come from the tool, never by hand.

## Do
1. `docker info`. Then `npm ci` if needed and `node scripts/migration-prove.mjs --base origin/main --write`. If image pulls fail the same way, try ONCE each: a retry later in the session, then the `--db-url` route (the script header explains it: a database that already holds the base replay; start a local Postgres from apt/pip packages if available, replay `main`'s migrations with `check:replay`'s own method, then `--db-url=postgres://...@localhost/...`). Time-box: if neither works after these, STOP.
2. Commit the regenerated fixtures (all changed and new files the tool writes). Re-run `node scripts/migration-prove.mjs --base origin/main` WITHOUT `--write` and paste that it is green. Run `npm run migration:prove -- --static-only` and `npx vitest run tests/organiserR1A1.db.test.ts` too (the latter only if it runs here).
3. Update the B2 row in `handovers/A1.md` with the real result.

## If it cannot run
Say so plainly (exact error, which routes you tried) in the handover; push ONLY the handover edit; do NOT hand-write fixtures. The orchestrator then marks B2 NOT VERIFIED in the review pack.

## Output
ONE push of `claude/org-r1-admin`. Last commit subject ends `[worker-done <ticket>]` (`PARTIAL [worker-done <ticket>]` at 25% context). Report head SHA and a Verified / Not verified. Context cap 30%.
