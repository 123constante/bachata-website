# S-REHEARSAL handover -- BLOCKED: needs owner: E2E key / network

Date: 2026-10-20. Branch `claude/org-r1-e2e-rehearsal` (from `main` at 9d283c5). No product code changed.

## Result
The rehearsal did NOT run. The brief's hard limit says to stop, not fall back to prod, when E2E cannot be reached.

## Why
- `SUPABASE_ACCESS_TOKEN` in this worker's env: the Management API for E2E ref `srrpvuxldthwumzrngla` answered `401 Invalid access token` on the ledger query (`select max(version), count(*) from supabase_migrations.schema_migrations`).
- `E2E_ORGANISER_OWNER_PASSWORD` / `E2E_ORGANISER_CONTRIBUTOR_PASSWORD` are not set, and the seed script (`scripts/e2e/seed-organiser-real-rpc.mjs`) needs both.
- `SUPABASE_URL` in the shell points at PROD (`stsdtacfauprzrdebmzg`); the seed script correctly refuses that. Nothing was run against prod.
- The Supabase MCP connector here is the prod project (read-only); it was not used as a substitute for E2E.

## Ledger comparison
Not done (E2E unreachable). Needed: E2E max version must be >= 20261129200000.

## Step table
All steps (New event, Sessions, dates, Team, My page, End series): NOT RUN. No screenshots in `docs/organiser-rebuild/walk-REHEARSAL/`.

## Brief note
The brief names `tests/e2e/organiser-r1.real-rpc.spec.ts`; that file does not exist on main. The nearest is `tests/e2e/organiser-real-rpc.spec.ts` (`npm run test:e2e:organiser-real-rpc`), and it likely needs extending for the Sessions / dates / Team / My page steps.

## Next steps (owner)
1. Provide a valid E2E Management API PAT as `SUPABASE_ACCESS_TOKEN`, plus `E2E_ORGANISER_OWNER_PASSWORD` and `E2E_ORGANISER_CONTRIBUTOR_PASSWORD`; unset prod `SUPABASE_URL`/`VITE_SUPABASE_URL` in that env (point at E2E).
2. Confirm the spec filename and re-dispatch.

## Verified / Not verified
Verified: E2E token is rejected (401); seed prerequisites are missing. Not verified: everything else (ledger, seed, spec, walk, screenshots, real phone keyboard, live storage, Docker).
