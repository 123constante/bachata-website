# Review r1: admin PR #1395 (ticket price steps T1) at head 7a0972e3

Independent and read-only. Brief: `docs/briefs/review-ticket-price-steps-t1.md` (branch `brief/review-ticket-price-steps-t1`).
Reference: `design-ticketing-organisers.md` s.2, s.3a, s.3c, s.5 T1 on `claude/revise-ticketing-design` (5d280fec1).
Reviewed tree: `123constante/bachata-admin` `claude/ticket-price-steps-t1` @ `7a0972e38422f35a324c6607c52cd9104c0872e5`,
diff vs base `1044453`. Stopping rule: ONE round.

## Verdict: HOLD. It is procedural only: no code change is needed.

The migration, guard and tests match s.5 T1. Every mutant was killed (21 run; see below). The one blocker is the
CI job **`prove` = FAILURE at the head**. The cause is NOT the code. The job read the round-1 PR body, whose Undo
SQL drops `ticket_price_step_set_v1(uuid, uuid, timestamp without time zone, integer)` (the round-1 signature, commit
9f02859 line 539). The prove job started at 22:59:01Z; the round-2 body landed with the PR update at about 22:59:04Z.
The CURRENT body's Undo SQL, run through the repo's own `proveUndo()` on a T1-migrated PG16 stub, returns
`{ok:true, leftBehind:[], notRestored:[]}`. So once a fresh `prove` run reads the current body and is green, this
review is a **PASS with no code changes**.

## Findings (ranked)

| # | Sev | Where | Finding | Exact fix |
|---|---|---|---|---|
| F1 | HIGH (gate) | CI `prove` job 130190153318 | `[FAIL] undo proof: undo SQL raised: function public.ticket_price_step_set_v1(uuid, uuid, timestamp without time zone, integer) does not exist`. A stale PR body (round 1) was used; see above. | Start a NEW `prove` run so it reads the current body: remove and re-add `run-ci`, or edit the body. "Re-run jobs" reuses the old event payload, so it will fail again. Merge only when `prove` is green at 7a0972e (or a later head). |
| F2 | LOW | `tests/ticketPriceStepsDb.test.ts:116` (M-1) | No DB row has TWO live steps. Mutant `ORDER BY s.effective_from ASC` (it returns the earliest live step, so a reserve charges the wrong price) passes all 9 DB tests. Only the text-pin regex in `tests/ticketPriceSteps.test.ts:50` kills it. | Add an M-1 row: base 1500, steps 2000 at T1 and 2500 at T2 (both past, inserted as owner). Expect seam = 2500, and reserve v4 line unit = 2500. Can be a T2 follow-up. |
| F3 | LOW | migration `:510-563` (`DO $verify$`) | The design's s.5 post-apply list includes "`proconfig` contains `search_path=pg_catalog, public`" for each new or replaced function, and "the `reserve_not_ready` gate query returns rows". Neither is in the self-verify. They are covered only by text pins (`ticketPriceSteps.test.ts:54,75`, which kill mutants m19/m21) and by DB test M-15. The outage guard (v3/v4 service_role = true) implies the gate today. | Add both to the post-apply SELECT pasted in the PR after apply (no migration change is required). |
| F4 | LOW (design question) | migration `:253` | `same_price` refuses a step equal to the BASE even when the previous step differs. Example: base 1000, step 1500, then a step back to 1000 is refused, although it changes the price. This is the literal s.2b text, but not its stated reason ("nothing changes"). | No T1 change. Lead: confirm the intent for the T3 copy, or relax it to "equal to the effective price just before the new instant" in a later slice. |
| F5 | INFO | migration `:84-95`, `:113-119` | Two additions outside the s.5 list: (a) `_ticket_price_steps_undo_v1` stays in `public` after apply (RLS on, every role revoked, holds function text only); (b) `GRANT SELECT ... TO ticket_backup`. (b) matches the prod precedent: `ticket_order_lines` relacl = `postgres=arwdDxtm, service_role=r, ticket_backup=r` (read 2026-11-10). | None. Optionally note the undo table's lifetime (drop it in T2b). |
| F6 | INFO | design s.5 T1 | `scripts/onboarding-write-doors.json` does not exist in the admin repo (checked). `DOORS` in `scripts/check-ticket-door-gate.mjs` holds both writers. Mutant m20 (gate removed from set) is killed by the door-gate self-test, the stub census and `ticketDoorGate.test.ts`. | None. |
| F7 | INFO | `scripts/check-ticket-price-seam.mjs` | The guard runs only in `migration-prove` (replay). It has no scheduled prod census like `ticket-door-gate.yml`. Replay covers every migration PR; prod drift outside migrations is barred by policy. | Optional: add a `--known-red` prod census step to a scheduled workflow (same pattern as `ticket-door-gate.yml`). |

## Check 1: s.5 T1 items (all present; nothing from T2/T4 leaked)
- Present: `ticket_price_steps`; `_at` seam with the seam body change; set/remove writers; upsert `has_price_steps`; `ticket_types_manage_v1`; summary v1/v2 patched to the seam; `reserve_not_ready` gate `v[1-4]`; callerless-only REVOKE; N4 guard with a shrink-only list.
- Door-gate list: done through `DOORS` (F6).
- Not leaked: there is no `reserve_v5`, `expected_total`, `reserve_version` or `public_v3` anywhere in the migration (grep). Edge functions are unchanged (no `supabase/functions` path in the diff).
- Item "price_changed passes when expected price omitted": not applicable to T1 (v5 is T2). Recorded as N/A, not as a mutant.

## Check 2: seam and callerless retirement
- One seam: `_ticket_effective_unit_price_v1` = `SELECT _at(p_type, p_occurrence_id, now())`. `_at` is STABLE, not a definer, and has the pinned path. Summaries, manage, and reserve v4 (unchanged) call it.
- Upsert N4 guard is at `:436`. Writers check, in order: FOR UPDATE, can-manage, onboarding, gate, old/new > now(), count, same instant, price, base, same_price. This is the s.5 order.
- Prod (read-only, 2026-11-10): the only function calling the seam is reserve v4 (postgres-owned definer). The seam is already owner-only, so a definer caller is required.
- **Callerless, verified independently:**
  - prod `pg_proc` prosrc in all non-system schemas: 0 functions reference reserve v1/v2, public v1 or preview v1 (outside themselves).
  - `cron.job`: 0 references.
  - Deployed edge `ticket-checkout` v22: the only `rpc(` calls are `ticket_checkout_reserve_v3` and `_v4`. The v1/v2 strings appear only in comments.
  - Deployed `public-api` v34: no ticket RPC.
  - Admin source `supabase/functions` + app: comment-only hits.
  - **Website `origin/main` (f0f3b29): no caller of `ticket_promo_preview_v1` / `ticket_types_public_v1` / reserve v1/v2.** Live calls are `ticket_types_public_v2` (`ticketCheckoutApi.ts:51`), `ticket_promo_preview_v2` (`:66`) and `ticket_sales_summary_v1` (`ticketsApi.ts:93`, kept and patched). This is the pre-condition the PR left Not verified; paste it into the PR.

## Check 3: ACL (prod before apply, stub after apply)
- On the stub after apply: anon has no EXECUTE on any new function. authenticated can call set/remove/manage. The seam and `_at` are owner-only. The four retired functions are false for anon, authenticated and service_role. Reserve v3/v4 service_role = true. Table: RLS on, no policy, service_role SELECT only.
- Prod before apply: the 4 replaced bodies' md5 equal the migration's pins (`9ca35af2`, `6706fd9f`, `7cce965b`, `f6b53ac2`). The stub's md5 equal prod for those and also reserve v3 `21481077` / v4 `a54e9801`. preview v1 and public v1 are anon-executable today, so T1 removes two anon doors.
- London time / DST: there is no SQL wall-time conversion (s.2c: a client rule for T3). The server compares instants only.

## Check 4: prod shapes (read-only counts, stsdtacfauprzrdebmzg, 2026-11-10)

| Shape | Prediction | Result |
|---|---|---|
| ticket types total | about 17 | 17 |
| on_sale / paused / closed | most on_sale | 15 / 2 / 0 |
| free (price 0) | 1 | 1 (paused, no orders): the upsert N4 guard cannot fire on it (no steps) |
| huge (>= 100000p) | 0 | 0 (max 14900) |
| with orders | 2 | 2 (5 orders, 5 lines) |
| with steps | 0 (table absent) | table absent |
| kind=course | 0 | 0 (all `night`) |
| series with > 100 types | 0 | 0 |
| DB TimeZone | UTC | UTC |
| `ticket_backup` role | exists | exists (1) |

## Check 5: tests and CI
- Local PG16 stub (handover recipe; md5 parity with prod above): `ticketPriceStepsDb` 9/9, `ticketPriceSteps` 15/15, `ticketDoorGate` 5/5. Seam self-test ok; door-gate self-test ok. Seam census on the stub: 3 known-red (reserve v3, preview v2, public v2), exit 0.
- Undo (current body) through `proveUndo()`: ok, shape equal.
- CI at 7a0972e (check runs read 2026-11-10 ~23:05Z):

| Job | Result |
|---|---|
| prove | **failure** (stale-body undo, F1). Before the undo step: applied with self-verify, door gate ok, seam ok, 10 files / 370 tests passed |
| unit-build | success |
| caller-census | success |
| edge-function-logic | success |
| rpc-body-snapshots | success |
| trunk-seam-guards | success |
| arc-gates | success |
| ledger-sync | success |
| boundary-stamp | success |
| placeholder-merge-gate | success (one earlier run cancelled) |
| pr | success |
| automerge | success (one earlier run cancelled) |
| workflow-artifact-policy | success |
| open-pr | success |
| header | cancelled / skipped (not run at the head on the final body) |
| daily-contract-batch, sweep, announce-failure | skipped |

## Check 6: mutants (each on a fresh copy of the pre-T1 stub DB, the mutated migration applied, then the PR's tests)

| # | Mutant | Result |
|---|---|---|
| m01 | seam ignores steps (`false AND ...`) | KILLED: 4 DB tests |
| m02 | boundary `<=` -> `<` in `_at` | KILLED: 1 DB test (M-1) |
| m03 | `ORDER BY effective_from ASC` | KILLED by text pin only (`ticketPriceSteps.test.ts`); 9/9 DB tests pass (F2) |
| m04 | N4 upsert `has_price_steps` guard removed | KILLED: 1 DB test (M-11) |
| m05 | anon left in on `step_set_v1` (REVOKE without anon) | KILLED: apply aborts in verify. With verify stripped: 2 DB tests |
| m06 | anon left in on `ticket_types_manage_v1` | KILLED: verify. With verify stripped: 2 DB tests |
| m07 | reserve v2 left callable | KILLED: verify. With verify stripped: 4 DB tests + seam guard RED |
| m08 | preview v1 left callable | KILLED: verify. With verify stripped: 1 DB test + guard RED |
| m09 | gate regex `v[1-3]` (misses v4) | KILLED: 1 DB test (M-15) |
| m10 | set: can-manage check removed | KILLED: 1 DB test |
| m11 | remove: can-manage check removed | KILLED: 1 DB test |
| m12 | manage_v1: can-manage filter removed | KILLED: 1 DB test |
| m13 | move of a LIVE step allowed | KILLED: 1 DB test |
| m14 | remove of a LIVE step allowed | KILLED: 1 DB test |
| m15 | max steps 4 | KILLED: 1 DB test |
| m16 | summary v2 left on `t.price_pence` | KILLED: verify. With verify stripped: 1 DB test + guard RED |
| m17 | `GRANT SELECT` on steps to authenticated | KILLED: verify. With verify stripped: 1 DB test |
| m18 | `same_price` vs base dropped | KILLED: 1 DB test |
| m19 | `_at` made SECURITY DEFINER | KILLED by static test only (DB 9/9 pass, because REVOKE still blocks callers) |
| m20 | onboarding gate removed from set | KILLED: door-gate self-test, stub census `door_gate_count`, `ticketDoorGate.test.ts` (DB 9/9 pass) |
| m21 | `SET search_path` dropped from set | KILLED by static test only |

Survivors: none. Weakest kills: m03, m19, m21 (text pins only; F2, F3).

## Verified
- Every s.5 T1 item is present, and no T2/T4 objects are in the diff (Check 1).
- Callerless retirement: checked across prod pg_proc, cron, the deployed `ticket-checkout` v22 and `public-api`, admin source, and Website `origin/main` f0f3b29 (Check 2).
- Prod md5 pins equal the migration's. The stub equals prod for 6 functions. Prod shape counts are in Check 4.
- The PR's tests pass on the stub. 21 mutants, all killed. The undo of the current body is proven on the stub.
- CI read at the head: `prove` red for a stale-body reason that is identified and reproduced; the other jobs are as listed.

## Not verified
- A green `prove` run at the head with the current body (F1). That run is the gate.
- The `header` (Migration Header) job on the final body: it was not run at the head.
- Manager-role (non-owner member) access to the writers and manage RPC. Only the owner and stranger shapes are tested.
- Post-apply prod read-back: nothing is applied (by design).
- Deployed bundles of the other ticket edge functions (`ticket-refund`, `stripe-webhook`, `ticket-email`, `ticket-ops-health`, `ticket-hold-sweep`) were not fetched one by one. Their source on admin `main` has no call to a retired function.
- No phone QA: DB-only PR, no UI.
