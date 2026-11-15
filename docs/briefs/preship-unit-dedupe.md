# Brief: stop running the unit suite twice per ship

Owner goal: shipping a Website change must not run the unit suite twice. Normal lane, Website repo, branch `claude/preship-unit-dedupe` off `main`, one PR. Brief-version: 2

Today (read first): `npm run pre-ship` (`scripts/pre-ship.mjs`, step `test:unit`, full suite incl. `*.contract.test.ts`) and then `.githooks/pre-push` (`npm run test:unit:offline`, a strict SUBSET of test:unit) both run the unit tests on the same commit.

Do:
1. `pre-ship.mjs`: when its `test:unit` step passes, write a stamp file under `.git/` (not tracked) keyed by `git rev-parse HEAD^{tree}` (the TREE sha, so an amend or rebase with an identical tree still counts) with a timestamp.
2. `.githooks/pre-push`: before the offline unit gate, if a stamp exists for the CURRENT tree sha and is less than 60 minutes old, print one line `> pre-push: unit gate skipped (pre-ship passed on this exact tree <sha7>, <n> min ago)` and skip it. No stamp, a different tree, a stale stamp, or any unreadable/garbled stamp = run the gate exactly as today (fail closed).
3. Keep every other pre-push step untouched. Do not touch CI.
4. Tests: pure function for the stamp decision, unit-tested for: fresh+same tree skips; different tree runs; stale runs; missing runs; garbled runs; non-vacuity (mutating the comparison must fail a test).
5. This edits `.githooks/**` (hard-tier path): open the PR as the bot. Do not merge.

Done = PR open, new tests green locally, PR body: what changed, Not verified.
