# Ticketing price-steps design: fixes for review r1

Written 2026-11-10 by the revise worker (dt_d5ce36fc31bd). Docs only, no code. Review: `docs/review/ticketing-organisers-r1.md` (branch `claude/review-ticketing-organisers`, verdict HOLD). Revised docs on this branch: `docs/briefs/design-ticketing-organisers.md` (DRAFT 2) and `docs/briefs/contract-ticket-tiers.md` (DRAFT 4, new section 0c). Inventory: `docs/briefs/revise-ticketing-design.INVENTORY.md`.

| F | Sev | Section changed | Test / mutant that would catch a regression |
|---|---|---|---|
| F1 | HIGH | design s.2a (one seam: existing `_ticket_effective_unit_price_v1` + `_at`), s.3a (retire reserve v1-v3, `reserve_not_ready` gate over v1-v4, G-1 proof as T2 pre-condition), s.5 T1/T2; contract 0c R-1, V-7 note, OPEN-6 closed | M-3: every reserve with service_role EXECUTE prices a stepped type at the seam. Mutant: restore `v_type.price_pence` in any executable reserve -> red. Static `prosrc` guard. M-15 mutant: gate regex `v[123]` -> red |
| F2 | HIGH | design s.2a (exhaustive reader list), s.3c (public v3 price + sort + next step, preview v1/v2 on the seam, public v1 revoked); contract 0c R-2 | M-2 parity at T-1s/T/T+1s with and without a code. Mutant: preview keeps `v_type.price_pence` -> red |
| F3 | HIGH | design s.3b (required `expected_unit_price_pence` per line + `p_expected_total_pence` on v5, no default; `expected_price_required`; reply shape; placement before capacity and promo rows; edge and client contract); contract 0c R-3 | M-5, M-6, M-7. Mutants: null expected treated as match; only line 1 compared; check after the capacity UPDATE; check after the promo refusal insert -> each red |
| F4 | MED | design s.3d (shared floor discount; fixed code clamp after a step down; fee drift caught by expected total) | M-8 (fee mismatch -> `price_changed`), M-9 (step down x fixed code) |
| F5 | MED | DECIDED: design s.1 (absolute date/time per type, applies to every night, editor copy), s.5 T3, OPEN-D7 parked; contract 0c R-4 | M-10: per-night type, nights N1 and N2 both at the new price after T |
| F6 | MED | design s.2b (upsert refuses 0 while steps: `has_price_steps`; writer `not_paid_ticket`, `same_price`; Website copy); contract 0c R-5 | M-11, M-12. Mutant: drop the upsert check -> red |
| F7 | MED | design s.5 T1 (exact RLS/REVOKE/GRANT/search_path list + post-apply assertions); contract 0c R-6 | Post-apply privilege SELECT in the T1 PR. Mutant: drop a REVOKE -> the matching `has_*_privilege` assertion goes red |
| F8 | MED | design s.2c (London editor, round-trip refusal `time_does_not_exist`, ambiguous = later GMT instant stated, client-side "rises on" in Europe/London, server `now()`, `_at` boundary); OPEN-D4 closed; contract 0c R-7 | M-1 (T-1us / T / T+1us via `_at`), M-13 (five editor inputs), M-14 (London date across New Year and summer) |
| F9 | LOW | design OPEN-D5 reopened: re-derive the hold bound for v4/v5 from `hold_release` + sweep before T2; late payment at stored price ACCEPTED as a known row | M-16 |
| F10 | LOW | design s.3c: organiser reads `ticket_types_manage_v1` (base, current, steps); public sort by effective price | M-4 |
| F11 | LOW | design s.2b: invariant base > 0 iff all effective > 0, written into the T1 migration comment; free-ness checks unchanged | M-11/M-12 hold the invariant; a step can never exist on a base-0 type |

## Verified
- Prod `stsdtacfauprzrdebmzg`, one read-only SELECT 2026-11-10 (pg_proc / pg_stat_user_functions, no personal data): EXECUTE roles and `prosrc` price reads of reserve v1-v4, promo preview v1/v2, public v1/v2, sales summary v1/v2, and the seam (table in the inventory). Confirms review F1/F2 facts. `pg_stat_user_functions` calls are all 0 (tracking off), so G-1 is not closable from the DB.
- Every F1-F11 row maps to an edited section (inventory coverage 11/11).
- `npm run check:mojibake` on the branch.

## Not verified
- G-1: which reserve the deployed edge calls; the edge's per-line Stripe code (admin repo not in this session). The revised design makes it a T2 pre-condition with a method, it does not close it.
- Reserve v1-v3, preview v1/v2, `ticket_order_hold_release_v1` bodies (F9 bound not re-derived).
- Whether the Website still calls promo preview v1; whether `RETURNS TABLE` forces `ticket_types_public_v3` (assumed).
- No test, mutant or migration was written or run (docs only). No tsc (docs-only change). No phone walk (nothing built).
- F5 decision is owner-DELEGATED per the brief, not an owner click seen by this worker.

## Handover
Done: inventory, both docs revised, this table. Left: review r2 of DRAFT 2 with the admin repo attached (close G-1/G-3, read the v1-v3 / preview / hold-release bodies, confirm the v5 and public_v3 version choices). Next: after r2 PASS, write T1/T2 briefs from design s.5.

## r2 fixes (2026-11-10, dt_dabfdde5fdc6)
Review: `docs/review/ticketing-organisers-r2.md` (branch `claude/review-ticketing-organisers-r2`, verdict HOLD). Handover: `docs/review/ticketing-design-fixes-r2.md`.

| r2 finding | Sev | Status | Exact section (design = `design-ticketing-organisers.md` DRAFT 3, contract = `contract-ticket-tiers.md` DRAFT 5) | Mutant / test |
|---|---|---|---|---|
| N1 rollout would stop every live sale | HIGH | CLOSED | design s.3a phase table (T1 callerless only; T2 adds v5 + edge v5 path, keeps v3/v4 paths; T4 basket wire with expected values, 0 for free; T2b refuses missing values, removes v3/v4 paths, REVOKEs v3/v4/public v2; gate opens only after); s.3a G-1 proof (v5-only marker `reserve_version = 5`, not "has lines"); s.3a deploy-order check (T4 < edge < migration timestamps, `DO` block count); s.3a post-revoke assertions; s.5 T1 outage guard, s.5 T2b; contract 0c R-1, OPEN-6 | M-17 T1 outage guard (v3/v4 service_role TRUE); mutant: revoke v3 in T1 -> red. M-15 mutants `v[123]`, `v[124]` -> red. T2b post-revoke `has_function_privilege` = false for v1-v4, run after the migration |
| N2 total check before refusal row impossible | MED | CLOSED | design s.3b "Two checkpoints in v5": (a) unit after seam (v4 l.116), before limiter 123 / code lock 145 / refusal INSERT 186; (b) total after fee (l.210), before capacity 215; contract 0c R-3 | M-7 (a): mutant unit check after refusal INSERT -> red. M-8 (b): mutant total check after capacity UPDATE -> red; refused-code case keeps its refusal |
| N3 no T2 privilege list | HIGH | CLOSED | design s.5 T2 list (v5 REVOKE FROM PUBLIC, anon, authenticated + GRANT service_role; public v3 GRANT anon, authenticated, search_path pinned; patched preview/public v2 keep ACL; retired: none in T2, v3/v4/public v2 in T2b) + T2 post-apply assertions; s.5 T1 `ticket_types_manage_v1` anon false / authenticated true; contract 0c R-6 | M-17; mutant: drop v5's REVOKE -> `has_function_privilege('anon', v5, 'EXECUTE')` true -> red |
| N4 guard not writable as regex | LOW | CLOSED | design s.2a static guard (strict: no `\.price_pence\b` in any executable reserve/preview/public/summary fn; known-red list may only shrink) | M-19: canary RED on prod today (probe 2026-11-10: reserve v1-v3, preview v1/v2, public v1/v2, summary v1/v2 carry the token; v4 does not) |
| N5 fee on zero net | LOW | CLOSED | design s.3b "Fee rule" (Website `fee = net > 0 ? fee x qty : 0`, replaces `TicketsBlock.tsx:207`), s.3d, s.5 T4; contract 0c R-3 | M-8b: 100% code with fee 50 -> no `price_changed`; mutant: fee on zero net -> red |
| N6 hold sweep has no scheduler | LOW | CLOSED | design s.5 T2 "Hold-sweep scheduler" (name it or add pg_cron); OPEN-D5; contract 0c R-8 | M-16 REQUIRED (hold released at +15 min, step at +20, pay at +30 -> stored price) |
| F1 (PARTLY) | HIGH | CLOSED | as N1 (retirement part); seam part unchanged (s.2a) | M-3 executable set per phase; mutant `v_type.price_pence` in v5 -> red |
| F3 (PARTLY) | HIGH | CLOSED | (a) as N2; (b) basket wire in T4, s.3a table + s.3b client contract; JSON `"1500"` / float `1500.5` type-checked before cast (s.3b) | M-5 adds `"1500"`, `1500.5` at DB and edge; mutant `::int` before type check -> red |
| F7 (PARTLY) | MED | CLOSED | as N3; s.5 T1 assertions add `ticket_types_manage_v1` and the outage guard | M-17 |
| F9 (PARTLY) | LOW | CLOSED | design OPEN-D5 BOUNDED: price exposure <= ~32 min after the reserve (Stripe session, J-32); 15-min hold bounds capacity only; contract 0c R-8 | M-16 |
| F10 (PARTLY) | LOW | CLOSED (decision: PATCH) | design s.3c "Sales summaries": v1 has a live caller (`ticketsApi.ts:93`), so v1 and v2 are patched to the seam in T1 by `CREATE OR REPLACE`, ACL kept; s.5 T1 | M-18; mutant: leave `t.price_pence` in summary v1 -> M-18 and the N4 guard red |
