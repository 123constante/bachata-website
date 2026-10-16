# Brief A0b -- CONTINUE A0: fix the apply script, fix and run the seed, count, document

Repo `123constante/bachata-admin`, branch `claude/org-r1-e2e-parity` (EXISTS: head `2e0a988`, PARTIAL from the first A0 worker), base `main`. You are a fresh continuation worker. READ FIRST: `00-COMMON.md` next to this file with `<X>` = A0b (Website repo, branch `arc/briefs-organiser-r1`: `git fetch https://github.com/123constante/bachata-website.git arc/briefs-organiser-r1` then `git show FETCH_HEAD:docs/organiser-rebuild/briefs/00-COMMON.md`), then the first brief `A0-parity.md` and the branch's `docs/organiser-rebuild/handovers/A0.md`. Plain git only, no `gh api`. Write shell commands WITHOUT variables, loops or `$(...)`.

## Overrides of the standard worker prompt (owner-approved)
- **Supabase connector WRITES are allowed ONLY on project `srrpvuxldthwumzrngla` (E2E).** Never prod `stsdtacfauprzrdebmzg`: prod stays SELECT-only. Say the project id in every write call.
- Cost note: E2E compute is Small now (the Nano died under load). Run the seed in small batches (a few statements per call), not one 60 s blob.

## State you inherit (verified 2026-10-16 ~14:30Z by the orchestrator; do not redo)
- **The 121 prod-parity migrations are ALREADY APPLIED to E2E.** E2E ledger = 926 rows (= prod 925 + the extra `_restore_guard` row), last version `20261122370000`. Do NOT apply anything. Applied locally by the orchestrator from a scratch copy of the 121 files.
- Two files were applied with ONLY their declared `DO $verify$` block removed (`20261109840000`, `20261110080000`; marker `-- migration-prove: prod-data-self-verify`); their self-verify was NOT RUN on E2E. `20261109805000` ran its verify and passed. Record this in `E2E-PARITY.md` under "Not verified".
- Why the script's count was wrong: the first worker defined pending as "files on disk not in the E2E ledger" = 135. The right set is **prod ledger minus E2E ledger = 121**. The 14 extra files are on disk but NEVER reached prod: `20260814170000`, `20260814170100`, `20260814170200`, `20260912040000`, `20260913010000`, `20261022091000` .. `20261025070000`.
- E2E rows the orchestrator added by hand to get past data-shape guards (E2E only): (1) programme day/section/item with title starting `E2E-R1 pre-seed` + 2 teacher people rows on series `a0d17006-...0101`; (2) `person_roles` 4 teaching + 4 djing on the first 8 dancers; (3) venue `a6e8326b-...` set `publish_state='published'`; (4) one venue override on series `1bd91736-...` next scheduled date; (5) `organiser_profiles.show_contact_publicly = true` on all 10 existing rows. The seed must reconcile these (reuse, or reset where step 4 says so) and your report lists them.
- Schema facts after apply: E2E `entities` insert works with `type`; **`event_series_p5.type` is a GENERATED column** (error 428C9 if inserted).

## Owns (admin repo only)
`scripts/e2e-parity-apply.mjs`, `supabase/seed/e2e-organiser-r1.sql`, `docs/organiser-rebuild/E2E-PARITY.md`, `docs/organiser-rebuild/handovers/A0.md`. Nothing else. Never patch a migration file.

## Steps
1. **Script pending fix (RED first).** Add a test (a small `node:test` or the repo's existing script-test convention; read `package.json` and the `check-script-conventions` rules first) proving `pending = prod-ledger minus E2E-ledger` using fixtures: 135-on-disk vs 121-in-prod must yield 121 and must NOT list the 14 never-on-prod files. Run it against the OLD logic first and paste the failing output, then fix. The prod ledger is read with ONE read-only SELECT on `supabase_migrations.schema_migrations` (prod, via the connector) or taken from a `--prod-ledger <file>` argument for tests; the script must still refuse the prod ref as a WRITE target before any connection.
2. **Declared self-verify handling.** Mirror `scripts/migration-prove.mjs` lines 328-345 of this repo: a file containing `-- migration-prove: prod-data-self-verify` is applied to a non-prod target with ONLY its `DO $verify$ ... $verify$` blocks removed, and the script prints `self-verify NOT RUN` for it. Test with a fixture file. Prod is never a target, so this never weakens prod's dry run.
3. **Fix the seed** `supabase/seed/e2e-organiser-r1.sql` against the POST-apply schema: remove `event_series_p5.type` from the INSERT (generated column), then check EVERY column of EVERY insert against `information_schema.columns` on E2E (generated columns, new NOT NULLs, renamed columns, new CHECKs from the 121). Fix what is wrong; the seed stays deterministic, tagged `E2E-R1`, delete-then-insert, idempotent, and still refuses a prod-sized database.
4. **D74 (owner decision): public-contact flag mix.** The seed leaves `organiser_profiles.show_contact_publicly` at about **4 true / 6 false across the 10 original organisers**, and the 2 `E2E-R1` organisers that have a phone are **false** (so the Page screen sees the "off" shape). Prod today (2026-10-10): 0 true before the arc, so false is the realistic majority.
5. **Run the seed ONCE on E2E** via the connector in small batches, then run it a SECOND time and compare counts (idempotency). Paste both count tables. Use the count query in `handovers/A0.md` ("Exact next steps"), and extend it with: series in each shape of plan 2.4 (live with 0 upcoming scheduled dates; live whose only upcoming dates are all cancelled; scheduled+cancelled mix; 45-series page with 40 archived; 2-organiser series; 14+-date weekly night straddling 2026-10-25; course; festival), organisers with no contact email and no `organiser_claim_emails` row, and the D74 flag split.
6. **R3-3 on prod, read-only:** the first worker's figure is 16 (live series with 0 upcoming scheduled dates, cancelled excluded; 15 any-status). Re-run the ONE SELECT, record SQL + number; E2E must show a matching shape (at least 1 such series).
7. **`check:replay`** on E2E: run it only if Docker and the E2E DB password exist in your sandbox; otherwise write "NOT verified (no Docker / no DB password in the worker environment)". Do not fake it.
8. **Docs.** Update `E2E-PARITY.md` and `handovers/A0.md`: 135 vs 121 and why; the two verify-block files and "self-verify NOT RUN"; the hand-added E2E rows above; the schema drift facts; ledger 926 explained; final seed counts (both runs); "Verified / Not verified". Rewrite the old "blocked on a credential" status to DONE.
9. **CI table.** Read `.github/workflows` and run every job step that applies to the files you touched (script conventions, lint chain for scripts, mojibake). Put command + exit code per step in the handover. GitHub Actions on billed runners may refuse (payments annotation): that is not a code failure; your sandbox table is the fallback.
10. Last commit subject `... [worker-done <ticket>]`, push `claude/org-r1-e2e-parity`. If you reach 25% context, stop starting things and push PARTIAL with exact next steps.

## Tests (must be shown, not claimed)
- Pending-list test RED on old logic, green on new (121, not 135).
- Verify-block stripper test (fixture) and the NOT RUN line.
- Prod ref refused before any connection (re-run the existing refusal test).
- Seed twice: the two count tables are identical.

## Decisions embodied
D59, D74, R3-3, R3-4, R3-5, R3-6 + D56 (14 + 89 faces), R3-7, R3-15, R3-18.
