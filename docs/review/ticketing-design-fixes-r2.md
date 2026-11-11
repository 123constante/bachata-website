# Ticketing price-steps design: fixes for review r2 (handover)

Written 2026-11-10 by the revise worker (dt_dabfdde5fdc6). Docs only: no code, no migration, no write to prod. Review: `docs/review/ticketing-organisers-r2.md` (branch `claude/review-ticketing-organisers-r2`, verdict HOLD: N1-N6 plus PARTLY F1, F3, F7, F9, F10). Revised on branch `claude/revise-ticketing-design` (PR #1529): `docs/briefs/design-ticketing-organisers.md` (DRAFT 3) and `docs/briefs/contract-ticket-tiers.md` (DRAFT 5, section 0c). The same table is appended to `docs/review/ticketing-design-fixes-r1.md`.

## Decisions taken in this round
- Rollout is phased T1 -> T2 -> T4 -> T2b; nothing with a live caller is revoked or refused before its replacement is proven (design s.3a table).
- The G-1 marker is a new nullable `ticket_orders.reserve_version` written 5 by v5 only (T2). `hold_expires_at` cannot tell v4 from v5.
- F10: sales summary v1/v2 are PATCHED (not revoked) in T1: v1 has a live Website caller (`src/modules/organiser/tickets/ticketsApi.ts:93`).
- N4 guard covers summaries too (stricter than the review asked) and ships with a shrink-only known-red list.

## Verified
- Prod `stsdtacfauprzrdebmzg`, two read-only SELECTs on `pg_proc` (2026-11-10, no personal data): identity args, EXECUTE per role, `proconfig` and the `\.price_pence` token for reserve v1-v4, preview v1/v2, public v1/v2, summary v1/v2 and the seam. Results: v1-v3, preview v1/v2, public v1/v2, summary v1/v2 carry the token (N4 canary would be RED today); v4 does not; ACLs match review J-7..J-17; `ticket_types_manage_v1` and v5 do not exist yet. Both summaries read `t.price_pence` only for the per-type `price_pence` key.
- Website `origin/main`: `ticket_sales_summary_v1` caller at `ticketsApi.ts:93`; fee added to the post-discount total at `TicketsBlock.tsx:207`.
- Every r2 row maps to an exact section (table below). `npm run check:mojibake` on the branch.

## Not verified
- Deployed edge source was NOT re-read in this round (relied on review r2 s.2 for v22 dispatch).
- Admin repo (edge source, migrations, admin UI callers of preview v1 / public v1 / summary v2): not reachable here; made T1 pre-condition greps.
- How `ticket-hold-sweep` is scheduled (T2 must answer). Whether the Stripe session is always created immediately after the reserve (the OPEN-D5 bound assumes it).
- No test, mutant, migration or guard was written or run (docs only). No tsc needed (no TS touched). No phone walk (nothing built).

## Handover
- Done: N1-N6 and F1/F3/F7/F9/F10 closed in the docs; contract 0c R-1/R-2/R-3/R-6 rewritten, R-8 added; matrix M-3, M-5, M-7, M-8, M-15, M-16 rewritten; M-8b, M-17, M-18, M-19 added.
- Left: r3 check limited to N1-N3 (design s.3a, s.3b, s.5).
- Next: after r3 PASS, write the T1 brief from design s.5 T1.

## r2 finding -> section -> mutant/test
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

## r3 finding -> section -> mutant/test (review `ticketing-organisers-r3.md`, worker dt_a60d3a61bb20; fixes by dt_2a87d030f79b)
| r3 finding | Sev | Status | Section (design = `design-ticketing-organisers.md`, contract = `contract-ticket-tiers.md`) | Mutant / test |
|---|---|---|---|---|
| R3-1 total check after the supersede UPDATE | BLOCKING | CLOSED (text) | design s.3b checkpoint (b) moved to after v4 l.193 / 195-198, before 200, 213-225, 228, fee computed at 193; contract 0c R-3 | M-8 reworded; NEW M-8c: capped code + pending order same person + stale total -> earlier order `promo_use_released` still false; mutant check after supersede -> red |
| R3-2 checkpoint (a) position | NOTE | CLOSED | design s.3b (a): once after the loop (l.119), before 121; contract R-3 | M-7 unchanged |
| R3-3 edge path precedence | NOTE | CLOSED | design s.3a T2 row: `expected_total_pence` test before `lines`; v5 parser carries `expected_unit_price_pence` (`Number.isInteger`) | edge unit test: T4 body -> v5 RPC args carry both expected values |
| R3-4 marker / window | NOTE | CLOSED | design s.3a G-1 step 1 (`SET lock_timeout = '3s'` + retry, no backfill, optional CHECK) and step 2 (window = 24 h ending at the check, start no earlier than T4 deploy, same literal in the `DO`) | T2b `DO` block |
| R3-5 callers outside repo | NOTE | CLOSED | design s.3a G-1 step 4: grep all admin `supabase/functions/` and app source for `ticket_checkout_reserve_v[34]`, `ticket_types_public_v2`; stale-tab error state | pasted grep in T2b PR |
| R3-6 step table grant line | NOTE | CLOSED | design s.5 T1: `REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role` then `GRANT SELECT TO service_role`; writers keep default service_role EXECUTE (stated) | T1 INSERT assertion |
| R3-7 summary price after steps | NOTE | CLOSED | design s.3c sales summaries: T3 brief must seed the editor draft from the base read | T3 test: untouched save after a step leaves base unchanged |

Verified: text edits only, against the r3 review. Not verified: prod line numbers (taken from the review's read of v4, not re-read); `ticket_order_mark_paid_v1` cap behaviour (review's own Not verified); admin repo greps; no tsc/tests (docs only).
