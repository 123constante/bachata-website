# Brief A0 -- E2E project at prod parity

Repo `123constante/bachata-admin`, branch `claude/org-r1-e2e-parity`, base `main`. READ FIRST: `00-COMMON.md` next to this file applies with `<X>` = A0 (both files live in the WEBSITE repo on branch `arc/briefs-organiser-r1`: `git fetch https://github.com/123constante/bachata-website.git arc/briefs-organiser-r1` then `git show FETCH_HEAD:docs/organiser-rebuild/briefs/00-COMMON.md` and `git show FETCH_HEAD:docs/organiser-rebuild/R1-PLAN.md`). Plan sections for you: 2.4, 4.4 (A0 row), 4.5 Admin, 4.11, 4.12 R3-3, R3-4, R3-6, R3-15, R3-18, D56, D59.

## What (R3-15, D59)
Make the E2E Supabase project `srrpvuxldthwumzrngla` a faithful copy of prod's SCHEMA so every later R1 worker verifies there. Today it has 804 migrations, last `20261109740000`; prod's last is `20261122370000`; admin `origin/main` holds **121** migration files after `20261109740000` (counted 2026-10-16 with `git ls-tree origin/main supabase/migrations/`; the plan's "61" was an earlier count). Apply whatever is pending, in version order.

## Owns (files, admin repo only)
- `scripts/e2e-parity-apply.mjs` (read `package.json` first; if an E2E apply script already exists, extend it): applies pending migrations to the E2E ref IN ORDER with the Supabase CLI, the ref/URL read from the environment (`SUPABASE_E2E_REF` or `E2E_DB_URL`), and REFUSES the prod ref `stsdtacfauprzrdebmzg` by name before any connection.
- `supabase/seed/e2e-organiser-r1.sql` (idempotent; every row marked `E2E-R1` in its name or a tag so one statement deletes the set).
- `docs/organiser-rebuild/E2E-PARITY.md` (report) and `docs/organiser-rebuild/handovers/A0.md` (handover).
- Nothing else. Migration files are immutable once on main: never patch one.

## Steps
1. `git fetch origin main`. List `supabase/migrations/*.sql` with version > `20261109740000`. Read the E2E project's applied list (Supabase MCP `list_migrations` on `srrpvuxldthwumzrngla`) and compute the pending list.
2. Apply them in order to the E2E project (writes there are standing-approved by their CI use; prod stays read-only). If one fails: STOP, record the failing version + full error in the handover, push PARTIAL. Do not patch.
3. Run the admin repo's replay check (`check:replay` in `package.json`) against the E2E project; paste the result.
4. Seed the shapes (invented names, counts matter): an organiser with 1 live series with upcoming dates; one with 4-7 series; a live series with 0 upcoming dates; a live series whose ONLY upcoming dates are all cancelled (R3-3); one mixing scheduled + cancelled upcoming; a 45-series page with 40 archived (R3-4); a series with 2 organisers (R3-7); a 14+-date weekly night with one date each side of 2026-10-25 (R3-18); a course (`format='course'`, `recurrence_rule` set); a festival; 3+ organiser pages with NO contact email and no `organiser_claim_emails` row (R3-5), one page whose email matches a test login, one whose email differs; drafts aged 2 days and 9 days (`created_at` relative to `now()`, never a literal date); a city with 14 dancers with a photo AND an auth account and 89 with a photo and NO account (R3-6, D56); 1 open access request; 5 `event_attendance` rows status `going`.
5. Re-count R3-3 on PROD, read-only, ONE SELECT: live series with 0 upcoming SCHEDULED dates (cancelled excluded) vs the 2.4 figure 15; log SQL + number in `E2E-PARITY.md`.
6. Handover, last commit subject `... [worker-done <ticket>]`, push.

## Tests (4.5 Admin, R3-15)
- The apply script refuses the prod ref (exit 1, no connection): RED first = run it against the prod ref BEFORE the guard exists, paste that output, then add the guard.
- After apply: `list_migrations` on the E2E project ends at prod's last version; the replay check is green there.
- The seed is idempotent: run twice, counts unchanged (paste both counts).

## Decisions embodied
D59, R3-15 (A0 first), R3-3 (scheduled-only re-count), R3-4, R3-5, R3-6 + D56 (14 + 89 faces), R3-7, R3-18 (DST shapes).
