# Review r3 (narrow, last round): ticketing price steps, design DRAFT 3

Reviewer: worker dt_a60d3a61bb20 (not the r1/r2 reviewer), 2026-11-10. Docs only, read-only.
Inputs: `origin/claude/revise-ticketing-design` @ `c22434908beb4e80b647743d95a4f7ae053f3c15` -- `docs/briefs/design-ticketing-organisers.md` (DRAFT 3, "design:"), `docs/briefs/contract-ticket-tiers.md` s.0c, `docs/review/ticketing-design-fixes-r2.md` ("fixes:"). Inventory: `docs/review/ticketing-organisers-r3.INVENTORY.md` (15 items, 15 judged, 3 GAPs).

## Verdict: HOLD -- 1 BLOCKING (docs-only fix, one paragraph), 6 NOTEs

The phased rollout (N1) holds: no phase boundary sends a live call to a revoked function or an edge refusal before its replacement is deployed. The ACL lists (N3) are complete for functions; one table grant line is wrong but its own assertion catches it. F10 is safe. The blocker is in N2: checkpoint (b) as placed sits AFTER a write that v4 already makes, so a `price_changed` refusal there commits that write with no order behind it.

When R3-1 is fixed in the text (move checkpoint (b) up, fix mutant M-8), this design can go to the T1 brief without another review round; the NOTEs can be folded into the T1/T2/T2b briefs.

## R3-1 BLOCKING (N2) -- checkpoint (b) runs after the promo "supersede" write

design:71 puts the total check "after the fee is computed (v4 line 210) and BEFORE the capacity write (215/220) and the order INSERT (228)". Prod v4 (`ticket_checkout_reserve_v4(jsonb,uuid,text,text,uuid,integer,text,text,text)`, `pg_proc.prosrc`, read 2026-11-10) has a write between 193 and 210:

```
200  IF v_has_code THEN
201    -- Supersede (as v3, any type): this person's earlier pending orders on this code give their use back.
202    UPDATE public.ticket_orders o SET promo_use_released = true
       ... WHERE x.promo_code_id = v_code.id AND x.status = 'pending' AND <same person> ...
210  v_fee := CASE WHEN v_net = 0 THEN 0 ELSE p_booking_fee_per_ticket_pence * v_total_q END;
```

In v4 nothing refuses between 202 and 228, so the released use is always replaced by the new order's use. In v5 a refusal at (b) is a `RETURN` (the transaction commits): the buyer's earlier pending order loses its promo use and no new order takes it. That earlier order keeps its open Stripe session; if it is paid, `_ticket_promo_use_sync_v1` sets `promo_use_released := false` again (pending -> paid). Money path: code capped at N uses, buyer A holds use N in pending order P1, A's retry hits `price_changed` at (b) -> use N is free -> buyer B redeems it -> A pays P1 -> N+1 discounted sales on an N-cap code. Small but real organiser money, and it can be triggered on purpose by sending a wrong `expected_total_pence`.

Fix (text only): every input of the fee is known at line 193 (`v_net`, `v_total_q`, `p_booking_fee_per_ticket_pence`), so compute the fee there and run checkpoint (b) after 193 (and after the onboarding refusal 195-198, harmless either way) and BEFORE 200 (supersede), 213-225 (capacity) and 228 (order). Mutant M-8 as written ("total check after capacity UPDATE") would not catch a check placed at 211; add: mutant "total check after the supersede UPDATE" -> a test with a capped code, a pending order for the same person and a stale total must show the earlier order's `promo_use_released` still false. The "code refused at 186 wins" behaviour in design:71 is unchanged by the move (186 still precedes 193).

Not verified: whether `ticket_order_mark_paid_v1` re-checks the code's cap when a released-use order is paid (if it does, the money path closes, but the stale-release would still be wrong state; the fix is the same).

## N1 rollout -- every phase boundary

Live paths today (edge `ticket-checkout` v22, `updated_at` 1794338201022 = 2026-11-10 19:16:41 UTC): `_shared/ticketingHandlers.ts:202` sends a body containing `lines` to `basketCheckout` -> `ticket_checkout_reserve_v4` (:460); any other body -> `ticket_checkout_reserve_v3` (:265). Website body today: `ticketCheckoutModel.ts:235-246` (single shape, no `lines`) -> v3. Website reads `ticket_types_public_v2` (`ticketCheckoutApi.ts:51`), `ticket_promo_preview_v2` (:66), `ticket_sales_summary_v1` (`ticketsApi.ts:93`). No other `ticket_checkout_reserve_v*` call in the deployed edge (only a stale comment naming v1/v2 in `index.ts:7`).

| Boundary | Live calls at that moment | Revoked / refused at that moment | Result |
|---|---|---|---|
| before T1 -> T1 applied | v3 (Website), v4 (`lines`), public v2, preview v2, summary v1 | reserve v1, v2, public v1, preview v1 | OK: none of the four has a caller in edge v22 or Website main. Admin-repo grep is a pasted pre-condition (design:97). Summary v1 patched in place, ACL kept (R3-7). Seam already owner-only today (`proacl {postgres=X/postgres}`), so the T1 REVOKE on it changes nothing for v4. |
| T1 -> T2 (DB then edge) | same | nothing | OK: v5 and public v3 are additive; preview v2 / public v2 patched in place (same identity args, see I-12); with no steps (gate closed, I-6) the seam returns the base, so no price moves. |
| T2 -> T4 | T4 tabs: basket + expected values -> v5 path; old tabs: single body -> v3 | nothing | OK, with R3-3. If T4 ships before the T2 edge, v22 routes the T4 body to v4 (extra keys tolerated: v4 l.46-50 checks only `ticket_type_id`, `quantity`; edge `parseBasketLines` :392 drops them) -> charged the base = the shown price while no steps exist. No loss, no refusal. |
| T4 -> T2b edge | T4 tabs -> v5; old tabs -> refused `expected_price_required` before any DB call | the single and v4 paths | OK: only stale tabs are refused, with "Please reload" (design:61); they would otherwise have been charged correctly (no steps yet), so this is a deliberate, bounded refusal, not lost sales of current pages. |
| T2b edge -> T2b REVOKE | v5 only | v3, v4, public v2 | OK if the G-1 proof and `DO` block hold (R3-4). Old tabs re-fetching public v2 get an RPC error (R3-5). |
| after T2b | v5 | gate opens (no `reserve_v[1-4]` executable by service_role) | OK: service_role is a member of no role (`pg_auth_members` empty for it), not superuser; `has_function_privilege` is exact once PUBLIC and service_role are revoked. An edge rollback now fails closed (permission denied), as design:53 says. |

### R3-2 NOTE (N2) -- checkpoint (a) must sit after the loop, not at line 116
The seam call (v4 l.116) is inside the per-line loop 102-119, after the sale refusal (103) and unpaid cap (112-114). The reply lists "only stale lines" (design:73), so (a) has to run once after `END LOOP` (119) and before `IF v_has_code` (121). Every statement in 37-119 is a check, a lock (80, 95-99) or a read; nothing is written before 121, so (a) placed at 120 writes no refusal row and does not count toward the limiter, as claimed. Reword "right after the seam computes each line's unit (v4 line 116)" to "after the line loop (v4 line 119), before line 121".

### R3-3 NOTE (N1, T2 edge) -- path precedence and the line parser
The T2 v5 path is "selected when the body carries `expected_total_pence`" (design:48), but the T4 body also carries `lines`, and v22 tests `"lines" in b` first (:202) and `parseBasketLines` rebuilds each line as `{ticket_type_id, quantity}` (:392), dropping `expected_unit_price_pence`. The T2 brief must state: the `expected_total_pence` test runs BEFORE the `lines` test, and the v5 parser carries `expected_unit_price_pence` through (with `Number.isInteger`). If it is built the other way round, T4 sales silently go to v4 (no money lost while no steps exist) and the G-1 count (R3-4) never reaches 0, so T2b is blocked rather than unsafe. Add an edge unit test: T4 body -> v5 RPC args contain both expected values.

### R3-4 NOTE (G-1 marker `ticket_orders.reserve_version`)
- Backfill: none needed and none wanted; the 5 existing rows stay NULL, and `IS DISTINCT FROM 5` counts NULL as "not v5" -- correct.
- Nullability / hot path: `ADD COLUMN reserve_version smallint` with no default is catalog-only (no rewrite), but takes an ACCESS EXCLUSIVE lock on `ticket_orders` (3 triggers, read by every reserve and the webhook). Say in the T2 brief: `SET lock_timeout = '3s'` in the migration and retry, so it cannot queue behind a reserve and stall checkout.
- ACL: no column ACLs; table ACL is `authenticated=r`, `ticket_backup=r`, `service_role=arwdDxtm`, RLS on with one SELECT policy. Buyers cannot write the marker; service_role (the edge) could, so the marker proves "v5 wrote it" only together with the deployed-edge grep (G-1 step 3) -- which the design already requires. State `CHECK (reserve_version IS NULL OR reserve_version = 5)` is optional, not needed.
- Writers: only reserve v1-v4 `INSERT INTO ticket_orders` today (prosrc scan), so no comp/door path will leave NULLs after T4. Good.
- The window: design:56 and the `DO` block use `created_at > <T4 deploy time>` as a fixed literal. One old tab posting the single body in the first hours after T4 makes that count permanently non-zero for that literal. Define the window as "24 h ending at the check, starting no earlier than T4 deploy" and write that start as the `DO` literal, so the proof can be retaken after stale tabs die out.

### R3-5 NOTE (N1, T2b) -- callers outside this repo
G-1 step 4 greps only `supabase/functions/ticket-checkout/` and `_shared/` in the admin repo. Any other admin edge function or admin UI calling reserve v3/v4 or `ticket_types_public_v2` would stop working at the T2b REVOKE. Widen the T2b pre-condition grep to all of `supabase/functions/` and the admin app source for `ticket_checkout_reserve_v[34]` and `ticket_types_public_v2`. Also expect stale Website tabs that re-fetch public v2 after the REVOKE to show the ticket list's error state (no money effect).

## N3 ACL lists vs prod default ACL

Prod default ACL (`pg_default_acl`, owner postgres, schema public): functions `X` to anon, authenticated, service_role; tables `arwdDxtm` to anon, authenticated, service_role.

- T2 (design:113-120): v5 `REVOKE ... FROM PUBLIC, anon, authenticated; GRANT ... TO service_role` -- complete vs the default; assertion + mutant real. Public v3 explicit grants match the default (harmless). Patched preview v2 / public v2: `CREATE OR REPLACE` keeps ACL; current ACL anon, authenticated, service_role -- assertion matches. OK.
- T2b (design:60, 123): identity args checked against prod `pg_get_function_identity_arguments` for v1-v4 and public v2: all match. Revoking FROM PUBLIC, anon, authenticated, service_role covers every grantee prod shows (postgres keeps owner rights, which the gate ignores). OK.
- T1 functions (design:100-103): complete. `ticket_price_step_set_v1` / `_remove_v1` / `ticket_types_manage_v1` keep the default service_role EXECUTE (not revoked, not asserted). Harmless (service_role is trusted, writers check can-manage), but state it so nobody reads the list as complete.

### R3-6 NOTE (N3, T1) -- the step table grant line contradicts its own assertion
design:99: `REVOKE ALL ON TABLE public.ticket_price_steps FROM PUBLIC, anon, authenticated; GRANT SELECT ... TO service_role;`. The default ACL already gives service_role `arwdDxtm` on a new table, and `GRANT SELECT` removes nothing, so design:105's assertion `has_table_privilege('service_role','public.ticket_price_steps','INSERT') = false` would be RED on apply. Fix: `REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role;` then `GRANT SELECT ... TO service_role;`. Not a money issue (the assertion catches it before anyone relies on it) -- fix the text so the T1 PR does not fail its own gate. Also check the claim "(matches `ticket_order_lines`)" in the T1 PR; not re-verified here.

## F10 (summary v1/v2 patched in T1) -- safe

- Same return shape: `CREATE OR REPLACE` with the same signature and the same `jsonb_build_object` keys; only the `'price_pence'` expression changes (summary v1 l.11).
- No price change while no steps exist: the seam today is `SELECT p_type.price_pence;` (SQL, STABLE), and T1's seam returns the base when the type has no step; the `reserve_not_ready` gate keeps steps at zero until after T2b. So T1 changes no value the Website shows.
- Callable: both summaries are postgres-owned SECURITY DEFINER; the seam is postgres-owned with ACL postgres only -- the owner can call it.

### R3-7 NOTE (F10, after T2b)
After steps exist, the summary's `price_pence` becomes the CURRENT price, not the base. The Website maps it to `pricePence` (`ticketsApi.ts:76`). The upsert payload sends `price_pence: d.pricePence` (`ticketsApi.ts:184`). The T3 brief must prove the editor's draft is seeded from the base read (`fetchSeriesTypes`, `ticketsApi.ts:113-119`, later `ticket_types_manage_v1`), never from a summary row; otherwise saving an untouched edit after a step would write the step price into the base. Not reached before T2b, so not blocking now.

## Closure-table spot-check (3 quotes)

- **N2 row** (fixes:31) claims s.3b gives "(a) unit after seam (v4 l.116), before limiter 123 / code lock 145 / refusal INSERT 186; (b) total after fee (l.210), before capacity 215". design:70 says "right after the seam computes each line's unit (v4 line 116) and BEFORE the promo limiter (123-131), the code lock (145) and the refusal-row INSERT (186)"; design:71 says "after the fee is computed (v4 line 210) and BEFORE the capacity write (215/220)". The text says what the row claims and the prod line numbers are right -- but the substance is wrong at (b) (R3-1). Status should be REOPENED.
- **N3 row** (fixes:32) claims "s.5 T2 list (v5 REVOKE FROM PUBLIC, anon, authenticated + GRANT service_role ...)". design:114: "`REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role;`". Matches.
- **F10 row** (fixes:40) claims "v1 and v2 are patched to the seam in T1 by `CREATE OR REPLACE`, ACL kept". design:81: "T1 replaces it with `'price_pence', _ticket_effective_unit_price_v1(t, NULL)` by `CREATE OR REPLACE` (same signature, same key, ACL kept ...)". Matches.

## Verified
- Prod `stsdtacfauprzrdebmzg`, read-only SELECTs only (2026-11-10, catalogs and one `count(*)`, no personal data, no write): `pg_proc` owner / `prosecdef` / ACL / `proconfig` for reserve v1-v4, preview v1/v2, public v1/v2, summary v1/v2, the seam; v4 body lines 38-50, 101-131, 145, 168, 176-244; seam body; summary v1 `price_pence` line; `_ticket_promo_use_sync_v1` body; `pg_default_acl`; `pg_auth_members` / `pg_roles` for anon, authenticated, service_role; `ticket_orders` ACL, column ACLs, RLS policies, triggers, row count (5), `reserve_version` absent; functions that INSERT INTO `ticket_orders`; `ticket_types_manage_v1` / `ticket_price_step*` absent.
- Deployed edge `ticket-checkout` v22 via `get_edge_function` (dispatch :202, single path :265, basket parser :373-396, v4 call :460).
- Website `origin/main` f0f3b29: `CheckoutBody`, public v2 / preview v2 / summary v1 call sites, summary `price_pence` mapping and upsert payload.
- `npm run check:mojibake` on this branch.

## Not verified
- Admin repo (other edge functions, admin UI, migrations): not reachable from this sandbox (R3-5).
- `ticket_order_mark_paid_v1` cap behaviour on a released-use order (R3-1).
- Design s.6 matrix rows beyond the closure-table rows quoted; `ticket_order_lines` ACL claim (R3-6).
- No test, mutant or migration written or run (docs-only review). No tsc (no TypeScript touched). No browser walk (nothing built).
