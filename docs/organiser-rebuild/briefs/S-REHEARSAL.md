# Brief S-REHEARSAL -- end-to-end rehearsal of the organiser area on the E2E database (NOT prod)

Repo `123constante/bachata-website`, branch `claude/org-r1-e2e-rehearsal` (new, base `main`, which already contains #809 d283c57-era organiser R1). ONE push at the end. Plain git, never `gh api`; shell commands without variables, loops or `$(...)`. Nothing on the owner's PC. Stay under 30% context; push PARTIAL + handover by 30%. HTML entities in source. GitHub Actions may be refused for billing: not a code failure.

## Why
The owner chose (2026-10-20) an end-to-end rehearsal AFTER the merge train, on a branch/E2E database only, never prod. Admin A1 (060000/070000), AW1 (100000/110000) and the door (200000) are applied on prod; Website #809 is live.

## Hard limits
- Target ONLY the E2E Supabase project `srrpvuxldthwumzrngla`. Prod `stsdtacfauprzrdebmzg` is read-only for you and the seed script must keep its prod refusal. If you cannot reach E2E (missing key or network), STOP and report "needs owner: E2E key / network", do not fall back to prod.
- First step: compare the E2E ledger (`supabase_migrations.schema_migrations`) with prod's (read-only). If E2E lacks any migration up to 20261129200000, list what is missing and stop: applying admin migrations is the orchestrator's job through the admin repo.

## Do
1. Seed E2E with `scripts/e2e/seed-organiser-real-rpc.mjs` (prod-shaped: a live weekly series with 14 past + 50 future dates, a one-night event, an organiser with owner only, a person invitable).
2. Run `tests/e2e/organiser-r1.real-rpc.spec.ts` (and extend it only if a step below is missing) at 390x844 against a PRODUCTION build (`npm run build`, vite preview): New event (Weekly night) -> name, day, time, venue -> publish live; open Sessions for one date, add a session, add a performance, remove a session, REFRESH and confirm the saved state reads right (a saved removal must NOT say "Comes off this date when you save"; record the current wording as a known defect, do not fix it here); take a date off, cancel a date with a reason, put it back; Team: search, add a person, remove; My page: edit name and contact switches; End the series; each step's inverse leaves the data as found.
3. Walk every step in a real browser at 390x844 and save a screenshot per step in `docs/organiser-rebuild/walk-REHEARSAL/`; read them yourself.
4. Report every red as: step, expected, actual, screenshot, and whether it is a code bug or an E2E-data difference from prod.

## Report
Handover `docs/organiser-rebuild/handovers/S-REHEARSAL.md`: ledger comparison, step table (pass/fail), screenshots, per-job table (command, exit code), Verified / Not verified (honestly: real phone keyboard, live storage, Docker). Last commit subject ends `[worker-done <ticket>]`. Fix NO product code in this slice; defects go in the handover as the fix list.
