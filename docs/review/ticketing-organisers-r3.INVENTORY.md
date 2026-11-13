# INVENTORY: ticketing price-steps design review r3 (narrow)

Reviewer: worker dt_a60d3a61bb20, 2026-11-10. Inputs at `origin/claude/revise-ticketing-design` head `c22434908beb4e80b647743d95a4f7ae053f3c15`:
design = `docs/briefs/design-ticketing-organisers.md` (DRAFT 3), contract = `docs/briefs/contract-ticket-tiers.md` (DRAFT 5 s.0c, lines 27-38), fixes = `docs/review/ticketing-design-fixes-r2.md`.
Prod = `stsdtacfauprzrdebmzg`, read-only SELECTs on catalogs + one `count(*)`; edge = `get_edge_function('ticket-checkout')`.

| # | Item judged | Design text (file:line) | Prod object / code checked | Status |
|---|---|---|---|---|
| I-1 | Phase table T1 -> T2 -> T4 -> T2b | design:45-50 | edge v22 dispatch `_shared/ticketingHandlers.ts:202` (`"lines" in b` -> basket/v4, else v3 at :265) | judged (R3-3) |
| I-2 | T1 boundary: revoke only v1, v2, public v1, preview v1 | design:47, 103 | `pg_proc` ACL of reserve v1-v4 (service_role only), public v1, preview v1 (anon, authenticated, service_role); edge v22 has no `_v1`/`_v2` reserve call (only comment `index.ts:7`) | judged: OK |
| I-3 | T2 boundary: v5 path added, v3/v4 kept | design:48, 74 | edge `parseBasketLines` `ticketingHandlers.ts:373-396` rebuilds lines as `{ticket_type_id, quantity}` | judged (R3-3 NOTE) |
| I-4 | T4 boundary: Website basket wire | design:49; `src/modules/tickets/ticketCheckoutModel.ts:235-246` (single body today) | v4 accepts extra line keys (v4 l.38-50 checks only id + quantity) | judged: OK |
| I-5 | T2b boundary: edge first, then REVOKE v3, v4, public v2 | design:50, 123 | Website `ticketCheckoutApi.ts:51` only caller of public v2 in this repo | judged (R3-5 NOTE) |
| I-6 | `reserve_not_ready` gate | design:53 | `pg_auth_members`: service_role is member of no role; not superuser | judged: OK |
| I-7 | G-1 marker `ticket_orders.reserve_version` | design:55-56 | column absent today; table ACL `authenticated=r`, `service_role=arwdDxtm`, `ticket_backup=r`; 1 RLS policy (SELECT, authenticated); 3 triggers; 0 column ACLs; 5 rows, 30 cols; only reserve v1-v4 INSERT INTO ticket_orders | judged (R3-4 NOTE) |
| I-8 | Deploy-order check + `DO` block | design:59 | v22 `updated_at` 1794338201022 (2026-11-10 19:16:41 UTC) | judged (R3-4 NOTE) |
| I-9 | Checkpoint (a) unit | design:70 | v4 l.101-119 (seam l.116 inside the per-line loop), limiter 121-131, code lock 145, refusal INSERT 186 | judged (R3-2 NOTE) |
| I-10 | Checkpoint (b) total | design:71 | v4 l.193 net, 195-198 onboarding, **200-207 supersede UPDATE ticket_orders**, 210 fee, 213-225 capacity, 228 order INSERT; trigger `_ticket_promo_use_sync_v1` | judged (R3-1 BLOCKING) |
| I-11 | T1 ACL list | design:98-112 | `pg_default_acl` postgres/public: `r` arwdDxtm and `f` X to anon, authenticated, service_role | judged (R3-6 NOTE) |
| I-12 | T2 ACL list | design:113-120 | same default ACL; current preview v2 / public v2 ACL anon, authenticated, service_role | judged: OK |
| I-13 | T2b ACL list + post-revoke assertions | design:60, 123 | identity args match prod `pg_get_function_identity_arguments` | judged: OK |
| I-14 | F10 summary patch in T1 | design:81, 102 | summary v1 l.11 `'price_pence', t.price_pence`; seam today `SELECT p_type.price_pence` (SQL, STABLE, postgres-owned, ACL postgres only); summaries are postgres-owned definers | judged (R3-7 NOTE) |
| I-15 | Closure-table rows quote check | fixes:30-40 | rows N2, N3, F10 | judged (3 quotes) |

GAPs (not judged, outside this sandbox or scope): admin repo source (other edge functions or admin UI calling reserve v3/v4 or public v2); `ticket_order_mark_paid_v1` body (whether paying a released-use order re-checks the code cap); design s.6 mutant table text (M-15..M-19) beyond the closure rows.

Coverage: 15 items listed, 15 judged; 3 GAPs named.
