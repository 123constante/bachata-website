# Review r3 (shapes): ticketing price steps vs prod and Website main

Reviewer: worker dt_d51b0ed8881f, 2026-11-12. Brief: `brief/review-ticketing-organisers-r3:docs/briefs/review-ticketing-r3.md` (sha cd81120). Docs only, read-only (SELECT on catalogs + counts, no personal data, no write).
Inputs: design DRAFT 3 on main (`docs/briefs/design-ticketing-organisers.md`, R3-1..R3-7 folded in), `docs/review/ticketing-design-fixes-r1.md` (N1-N3 rows), r3 review `docs/review/ticketing-organisers-r3.md` (this branch).

## What changed since r3 (2026-11-10)

T1 and the DB half of T2 are LIVE on prod: `ticket_price_steps` (0 rows), `ticket_price_step_set_v1` / `_remove_v1`, `ticket_types_manage_v1`, `ticket_checkout_reserve_v5`, `ticket_types_public_v3`, `ticket_orders.reserve_version` (0 rows = 5). The edge is still `ticket-checkout` v22 (updated 2026-11-10 19:16 UTC): no v5 path. So the live state is "T1 + T2-DB, T2-edge not deployed". That is safe (v5 has no caller; nothing new is refused) but it is NOT the design's T2 unit (DB + edge together, design s.5); the T2-edge brief must still land before T4.

## Per-shape table

| Shape | Prod / code fact (2026-11-12) | Result |
|---|---|---|
| No steps | 0 rows in `ticket_price_steps`; seam `_ticket_effective_unit_price_at_v1` = `coalesce(latest step <= p_at, p_type.price_pence)` -> base. v3 (base read), v4/v5, public v2/v3, preview v2, summary v1/v2, manage v1 all agree at the base. | PASS |
| One step | Seam picks the latest `effective_from <= now()`. Every reader the Website calls (public v2, preview v2, summary v1) and v4/v5 call the seam. v3 reads `v_type.price_pence` directly (base) -- safe only because the gate (next rows) refuses any step while v1-v4 are executable by service_role. | PASS (gated) |
| Many steps | Same seam (`ORDER BY effective_from DESC LIMIT 1`); writer refuses `too_many_steps`, `out_of_order`, `same_price` (vs the previous step), `not_paid_ticket`, `invalid_price`. | PASS |
| Past step | `step_set_v1` refuses a new or moved step at/before now (`step_in_past`, l.35-40); `step_remove_v1` refuses removing a past step (l.33). Seam includes past steps (`<= p_at`). Gate `reserve_not_ready` in BOTH writers is a live `has_function_privilege('service_role', reserve_v[1-4])` check (set l.22-26, remove l.28-30): currently TRUE for v3/v4 -> refused. | PASS |
| price_changed between view and reserve | v5 (a) at l.146-169: once after the line loop, before the limiter (l.172), code lock and refusal INSERT (l.236) -- R3-2 applied; no write before l.236. v5 (b) at l.252-259: fee computed from `v_net`, `v_total_q`, fee input; check BEFORE the supersede UPDATE (l.264), capacity (l.272) and order INSERT (l.287) -- R3-1 applied. Missing/non-integer expected values -> `expected_price_required` (l.44-57, type checked before cast). Live path today (v3/v4 via edge v22, Website single body `ticketCheckoutModel.ts:235-271`) sends no expected values, so a base-price edit between view and reserve is still charged silently -- pre-existing, closed only at T4 + T2b by design. | PASS (design + v5 body); live protection pending T2-edge/T4/T2b |
| Course vs event | Seam and v5 do not branch on `kind` (design s.4: a course is a normal type and can have steps). Prod: 19 types, all `kind=night` (2 free), 0 course types. | PASS (design); course NOT exercised (no prod rows) |
| v1 vs v2 callers | reserve v1/v2, public v1, preview v1: ACL `postgres` only (T1 revoked). Website main calls only public v2 (`ticketCheckoutApi.ts:51`), preview v2 (:66), summary v1 (`ticketsApi.ts:108`); all executable by anon/authenticated as needed and all patched to the seam. Edge v22 calls only reserve v3 (`ticketingHandlers.ts:265`) and v4 (:460); v1/v2 named only in a stale comment (`index.ts:7`). Summary v2: authenticated only, seam, no Website caller. | PASS |

## N1-N3 and R3-* rows vs prod

- N1 (rollout): live boundary is T1 -> T2-DB; v3/v4 still service_role-executable (outage guard holds), v1/v2 revoked, nothing live refused. PASS. NOTE: T2-edge not deployed (above).
- N2 (checkpoints): (a) and (b) placed as R3-1/R3-2 require. PASS.
- N3 (ACLs): v5 `{postgres, service_role}` (no anon/authenticated) PASS; public v3 anon/authenticated PASS; step set/remove and manage v1 authenticated + service_role, no anon PASS; `ticket_price_steps` table `{postgres=arwdDxtm, service_role=r, ticket_backup=r}`, RLS on, no anon/authenticated -- R3-6 applied, PASS.
- R3-3 (edge precedence): NOT checkable -- edge v5 path not deployed.
- R3-4 (marker): column present, 0 rows with 5, 5 rows NULL. PASS. `lock_timeout` in the migration: Not verified (admin repo).
- R3-5 (admin callers grep): Not verified (admin repo not readable).
- R3-7 (editor seeding): Website `fetchSeriesTypes` reads `ticket_types.price_pence` directly (`ticketsApi.ts:130-134`), not a summary row. PASS on main today.
- R3-1 residual: `ticket_order_mark_paid_v1` has no promo/cap logic -- moot now that (b) precedes the supersede.

## G-1 (which reserve the prod edge calls)

Closed on the DEPLOYED side: edge `ticket-checkout` v22 calls reserve v3 (body without `lines`) and v4 (body with `lines`); no v5 call; 0 orders carry `reserve_version = 5`. Admin repo SOURCE vs deployed: Not verified (repo `bachata-admin-11april` not accessible to this session).

## Verdict

PASS -- T-briefs may be written. Two carry-overs for the brief author (not design changes): the T2-edge brief must ship the v5 path with R3-3's precedence before T4; R3-5's admin-wide grep stays a T2b pre-condition.

## Verified
- Prod `stsdtacfauprzrdebmzg`, read-only SELECTs 2026-11-12: `pg_proc` ACL / definer / bodies (grep by line) of reserve v1-v5, seam v1 + at_v1, public v1-v3, preview v1/v2, summary v1/v2, manage v1, step set/remove v1, mark_paid v1; `ticket_price_steps` ACL, RLS, row count; `ticket_orders.reserve_version` presence and count; `ticket_types` kind/free/per-night counts.
- Deployed edge `ticket-checkout` v22 via `get_edge_function` (reserve call sites).
- Website main `def110c5`: buyer body, public v2 / preview v2 / summary v1 call sites, editor base read.

## Not verified
- Admin repo source, migrations (`lock_timeout`, md5 vs prod), admin-wide caller grep (R3-5) -- repo not accessible.
- Course shape on real rows (none exist); any stepped price on real rows (no steps exist; gate closed).
- R3-3 edge precedence (edge v5 path not deployed). No test, mutant or browser walk (docs-only review; nothing built).
