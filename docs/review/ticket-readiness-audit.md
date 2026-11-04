# Ticketing go-live readiness audit (S6), 2026-11-01

Read-only audit. Docs only: no code, no flags, no env, no prod write. Prod reads were SELECT-only
via the Supabase MCP against `stsdtacfauprzrdebmzg`, counts/names only.
`plans/ARC-ticketing.md` lives on the owner machine and was NOT readable here; the brief was used instead.

Sources: admin repo `123constante/bachata-admin` main @ `0e483a4` (2026-11-01 12:14 UTC);
Website main @ `4ea927e`.

## 0. Headline findings (read these first)

1. **Placeholder collision.** #1132 and #1134 BOTH add `supabase/migrations/99990101000000_*.sql`
   (`99990101000000_ticket_door_short_code_v1.sql` and `99990101000000_my_tickets_v1.sql`, from
   `git ls-tree` of each head). Two files with one version cannot both be pushed; each needs its own
   real, fresh version before merge. Main has no `9999*` file.
2. **Deployed ticketing functions predate the fee-zero code on main.** All five ticketing functions
   were last deployed 2026-10-28 20:24:24-20:24:33 UTC (`list_edge_functions` `updated_at`
   1793219064-1793219073). Main's `DEFAULT_BOOKING_FEE_PENCE_PER_TICKET = 0` carries the comment
   "Owner choice 2026-10-29" (`supabase/functions/_shared/ticketing.ts:38-39`). So the deployed code
   most likely still defaults to the old 50p unless `TICKET_BOOKING_FEE_PENCE` is set. Prod agrees in
   shape: 3 of 4 orders have `booking_fee_pence > 0`, 1 has 0. **Deployed source was not diffed**
   (see Not verified). Go-live must redeploy from main and set the fee secret explicitly.
3. **Prod already processes Accounts v2 thin events while #1106 is unmerged.**
   `ticket_webhook_events` holds 29 `v2.core.account*` rows (all processed), but main's
   `stripe-webhook/index.ts` reads only `STRIPE_WEBHOOK_SECRET` (line 26) and has no thin path. The
   deploy time (20:24 UTC 2026-10-28) sits between #1106's two CI runs (20:16 and 21:22 UTC), so the
   deployed functions were most likely built from the #1106 branch, not main. Live deploy must come
   from merged main, or a later main deploy will silently drop the thin path.
4. **Ledger/file version drift on two ticketing migrations.** Ledger: `20261028203640
   ticket_order_public_status_v1`, `20261029181607 ticket_check_in_v1`. Repo files on main:
   `20270306190000_ticket_order_public_status_v1.sql`, `20270308040000_ticket_check_in_v1.sql`.
   Name matches, version differs. Whether admin's ledger-sync accepts this was not checked.
5. **#1134 has no proof run on its head.** On `f40d707` the `prove`, `edge-function-logic`,
   `ledger-sync`, `rpc-body-snapshots` jobs are all `skipped`, `automerge` `cancelled`; only
   `unit-build` and `open-pr` are green (check runs, 2026-10-30 15:13 UTC).

## 1. State table (admin PRs)

| PR | Head sha | Mergeable | Checks on head | Review on file + verdict | Migration | Applied on prod | Blocking items |
|---|---|---|---|---|---|---|---|
| #1131 email QR | `2085bb1` | `clean` | green: unit-build, workflow-artifact-policy, automerge, open-pr; skipped: edge-function-logic, caller-census, announce-failure | `docs/review/ticket-email-qr-r1.md` (branch `claude/review-ticket-email-qr-r1`): "No deploy blocker found" | none (edge fn only) | n/a; `ticket-email` deployed v7 2026-10-28 predates the PR (created 2026-10-30) | F1 PLAUSIBLE fix-before-deploy: Resend inline attachment needs `content_disposition` confirmed; real-inbox render not done (PR body NOT verified). `edge-function-logic` was skipped, not run |
| #1132 door short code + check-in RPCs | `668bd6a` | `unstable` (skipped jobs only, per PR body) | green: prove, unit-build, pr, rpc-body-snapshots, boundary-stamp, arc-gates, trunk-seam-guards, ledger-sync, edge-function-logic, caller-census, automerge | `docs/review/ticket-door-db-r1.md` (branch `claude/review-ticket-door-db-r1`): "no finding blocks apply"; finding 1 fix-before-apply, addressed in `0ca8a32` per PR body | `99990101000000_ticket_door_short_code_v1.sql`, **still placeholder** | **No**: `pg_proc` has no `ticket_check_in_by_code_v1` / `ticket_check_in_by_id_v1`; `tickets` has no `short_code` column; ledger has no `9999*` row | real version (collides with #1134); the fix round was not re-reviewed; Website copy for `too_many_attempts` not built |
| #1134 my_tickets_v1 | `f40d707` | `unstable` | green: unit-build, open-pr; **skipped**: prove, edge-function-logic, ledger-sync, rpc-body-snapshots, boundary-stamp, arc-gates, trunk-seam-guards, caller-census, pr, sweep; automerge `cancelled` | `docs/review/ticket-my-tickets-db-r1.md` (branch `claude/review-ticket-my-tickets-db-r1`): "no finding blocks apply"; F1/F2 fix-before-apply, addressed in `b56476b` per PR body | `99990101000000_my_tickets_v1.sql`, **still placeholder** | **No**: `pg_proc` has no `my_tickets_v1` | real version (collides with #1132); `run-ci` proof run never ran on this head; full Supabase replay not done (PR body) |
| #1106 Stripe Accounts v2 | `6aa1791` | `clean` (base `9d1960a`, main is now `0e483a4`) | green: unit-build, edge-function-logic, caller-census, automerge, open-pr | `docs/review/stripe-accounts-v2-r1.md` (branch `claude/review-stripe-accounts-v2`): "PASS with should-fix"; S1/S2a/S2b fixed per PR body | none | n/a (no migration). Code appears live already (finding 3), unverified | sandbox open items from PR body (lowercase `gb`, payouts capability, v2 link on v1 account, thin `evt_` ids vs CHECK N1, checkout+refund on a v2 account); "Accounts v1 support" OFF test not recorded |

Red also on main: **not checked** (no main-branch check-run read in this session).

Other open PRs named in the brief: admin #1068 (launch plan), #1081 (S1c review) were not read.
Website #1067 (critique of #1060) is open, `mergeable_state: clean`, head `fa21424`, one docs file,
body still the bot placeholder.

## 2. Prod reads (read-only, counts/names only)

### Ticket tables (exact `count(*)`)

| Table | Rows |
|---|---|
| `organiser_stripe_accounts` | 2 |
| `ticket_types` | 2 |
| `ticket_orders` | 4 |
| `tickets` | 6 |
| `ticket_webhook_events` | 80 |
| `ticket_checkout_attempts` | 0 |
| `ticket_status_reads` | 1 |
| `organiser_start_tickets_v1` | 0 |

Shapes:
- Stripe accounts: 2 of 2 have `charges_enabled/payouts_enabled/details_submitted` = true/true/true.
  Test vs live mode of those accounts is not stored in the table (no `livemode` column), so it is
  inferred, not proven, that both are TEST accounts.
- Ticket types: 2 of 2 `paused`, 0 on sale, 0 `manual_sold_out`.
- Orders: 3 `refunded`, 1 `paid`; 0 disputed; 4 of 4 `email_status = sent`. Fee: 3 with fee > 0, 1 with 0.
- Tickets: 3 `valid`, 3 `void`.
- Webhook events: 45 `account.updated`, 18 `v2...capability_status_updated`, 7 `v2...[requirements].updated`,
  4 `v2...[configuration.merchant].updated`, 3 `checkout.session.completed`, 3 `charge.refunded`.
  0 unprocessed. Last received 2026-10-29 00:27:15 UTC. No dispute or async-payment event ever received.
- Ticketing RPCs present in `pg_proc` (public): 32, including `ticket_check_in_v1`, `ticket_door_list_v1`,
  `ticket_order_mark_disputed_v1`, `ticket_order_dispute_closed_v1`. Absent: `my_tickets_v1`,
  `ticket_check_in_by_code_v1`, `ticket_check_in_by_id_v1`.

### Flags (Website)

| Flag | Read at | Vercel env name | Current value |
|---|---|---|---|
| `organiserTicketing` | `src/lib/featureFlags.ts:71` | `VITE_ENABLE_ORGANISER_TICKETING` | not verifiable (Vercel API blocked by egress proxy: `api.vercel.com` connect_rejected) |
| `publicTicketing` | `src/lib/featureFlags.ts:75` | `VITE_ENABLE_PUBLIC_TICKETING` | not verifiable (same) |
| preview origin (client) | `src/modules/tickets/ticketCheckoutModel.ts:155` | `VITE_TICKET_PREVIEW_ORIGIN` (prod builds fold to '' per line 139) | not verifiable |

Gate sites: `/tickets/thanks` route `src/components/AnimatedRoutes.tsx:235`; organiser routes
`AnimatedRoutes.tsx:272` (needs organiserTicketing AND organiserP3 AND organiserSelfServe); door
scanner route `src/modules/organiser/p3/shell/P3Routes.tsx:69`; event-page tickets block guarded per
`src/modules/tickets/__tests__/flagOff.test.ts:31`.

### Edge functions (ticketing; `list_edge_functions`)

| Slug | Version | verify_jwt | Last deployed (UTC) |
|---|---|---|---|
| `stripe-webhook` | 8 | false | 2026-10-28 20:24:24 |
| `stripe-connect-onboard` | 9 | true | 2026-10-28 20:24:26 |
| `ticket-checkout` | 8 | true | 2026-10-28 20:24:28 |
| `ticket-refund` | 7 | true | 2026-10-28 20:24:32 |
| `ticket-email` | 7 | false | 2026-10-28 20:24:33 |

### Secret names

`TICKET_BOOKING_FEE_PENCE`, `TICKET_PREVIEW_ORIGIN`, `STRIPE_WEBHOOK_SECRET_THIN`: **not verifiable**.
The read-only MCP has no list-secrets tool (only `create_edge_function_secret`, a write, not used).
Code readers: `ticketingHandlers.ts:215` (fee), `ticketingHandlers.ts:55` (preview origin),
`ticketing.ts:78-79` (`STRIPE_MODE`, `STRIPE_SECRET_KEY`), `stripe-webhook/index.ts:26`
(`STRIPE_WEBHOOK_SECRET`). `STRIPE_WEBHOOK_SECRET_THIN` is read only on the #1106 branch.
Indirect evidence the thin secret exists on prod: 29 processed thin events (finding 3).

## 3. Go-live checklist (S6)

Order matters. Each step lists WHERE, what you should see, and its rollback.

0. **CLAUDE-CAN-DO (merge prep, owner merges).** Give #1132 and #1134 distinct real versions; re-run
   `run-ci` proof on #1134; rebase #1106 on main; confirm #1131 F1 (`content_disposition`).
   WHERE: admin PRs. SEE: both migration files with different non-`9999` versions; `prove` green on
   each head. ROLLBACK: none needed (no prod effect).
1. **OWNER-ONLY: merge #1106, then #1131.** WHERE: GitHub admin repo. SEE: main contains
   `STRIPE_V2_VERSION` and the QR code. ROLLBACK: revert PR.
2. **CLAUDE-CAN-DO (owner approves deploy): redeploy all five functions from merged main** in #1106's
   order: `stripe-webhook`, `stripe-connect-onboard`, then `ticket-checkout`, `ticket-refund`,
   `ticket-email`. WHERE: `supabase functions deploy` from admin main. SEE: five new versions
   (> 8/9/8/7/7) with today's `updated_at`. ROLLBACK: redeploy the previous main commit's functions.
3. **OWNER-ONLY: fee secret = 0.** WHERE: Supabase dashboard > Edge Functions > Secrets, set
   `TICKET_BOOKING_FEE_PENCE=0` (explicit, so a code default change cannot re-enable a fee). Code
   DEFAULT is already 0 on main (`ticketing.ts:39`); unset/malformed also reads 0 (`ticketing.ts:83-90`).
   SEE: a fresh TEST checkout creates an order with `booking_fee_pence = 0`. ROLLBACK: set back / unset.
4. **OWNER-ONLY: remove `TICKET_PREVIEW_ORIGIN`.** WHERE: Supabase secrets, delete it. Unset = no
   preview origin (`ticketing.ts:109-118`). Also confirm `VITE_TICKET_PREVIEW_ORIGIN` is not set for
   Vercel Production. SEE: checkout from a preview URL is refused by CORS; from
   `https://bachatacalendar.co.uk` it works. ROLLBACK: re-add the secret.
5. **OWNER-ONLY: Stripe sandbox close-out of #1106 items** (PR body DEPLOY PLAN step 3): onboard a new
   sandbox organiser, complete it, one checkout + one refund on a v2 account, then turn "Accounts v1
   support" OFF and repeat. WHERE: Stripe TEST dashboard + Supabase logs. SEE: thin events recorded
   with `processed_at` set; no `account_link_v1_fallback` surprises. ROLLBACK: v1 support back ON.
6. **OWNER-ONLY: live webhook endpoint.** WHERE: Stripe LIVE > Developers > Webhooks > Add endpoint
   (snapshot payload) to the `stripe-webhook` URL, events: `checkout.session.completed`,
   `checkout.session.expired`, `checkout.session.async_payment_succeeded/failed`, `charge.refunded`,
   `charge.dispute.created/closed`, `account.updated` (Connect). SEE: endpoint enabled, signing secret shown.
   ROLLBACK: disable the endpoint.
7. **OWNER-ONLY: live thin event destination.** WHERE: Stripe LIVE > Event destinations, connected
   accounts, payload thin, API `2026-09-30.endive`, ONLY the four `v2.core.account*` types (#1106
   note N2). SEE: destination enabled. ROLLBACK: disable it.
8. **OWNER-ONLY: live secrets.** WHERE: Supabase secrets: `STRIPE_MODE=live`, `STRIPE_SECRET_KEY`
   (sk_live_/rk_live_; a test key is refused in live mode, `ticketing.ts:63-65`),
   `STRIPE_WEBHOOK_SECRET` (step 6), `STRIPE_WEBHOOK_SECRET_THIN` (step 7). SEE: function logs show no
   key-mode error on the next checkout. ROLLBACK: restore the TEST values and `STRIPE_MODE=test`.
9. **OWNER-ONLY: organiser re-onboards on LIVE.** WHERE: organiser Get paid screen. TEST
   `acct_` ids do not exist in live mode, so the 2 current rows will fail in live (inferred).
   SEE: a new `organiser_stripe_accounts` row reaches charges_enabled true via webhook.
   ROLLBACK: back to TEST secrets (step 8 rollback).
10. **OWNER-ONLY: flags.** WHERE: Vercel > Project > Settings > Environment Variables, Production:
    `VITE_ENABLE_ORGANISER_TICKETING=true`, then `VITE_ENABLE_PUBLIC_TICKETING=true`; redeploy.
    SEE: tickets block on a ticketed event page; `/tickets/thanks` resolves. ROLLBACK: set false,
    redeploy (routes and blocks disappear, `flagOff.test.ts`).
11. **OWNER-ONLY: first real purchase, 100p.** Create a 100p ticket type on a real night, set it on
    sale, buy one with a real card. SEE: order `paid`, fee 0, ticket `valid`, email with QR arrives,
    door scanner checks it in. ROLLBACK: pause the ticket type.
12. **OWNER-ONLY: refund it.** WHERE: organiser refund action (`ticket-refund`). SEE: order
    `refunded`, ticket `void`, `charge.refunded` event processed, money back on the card statement.
    ROLLBACK: none (refund is final); if it fails, refund from the Stripe dashboard.
13. **CLAUDE-CAN-DO: post-live read-only check** of the same queries in section 2 (counts only).
    SEE: 0 unprocessed webhook events; fee 0 on new orders.

## 4. Ordered build queue

| # | Item | Lane / model | Waits on | Parallel-safe? |
|---|---|---|---|---|
| 1 | Re-version #1132/#1134 placeholders + #1134 proof run | admin, normal, Opus | nothing | yes, but the two must pick distinct versions (one worker for both, or serialize) |
| 2 | Door scanner organiser screen: add short-code entry + check-in by id, `too_many_attempts` copy "use the Tonight list" (#1132 handover). The QR scanner already exists (`src/modules/organiser/p3/door/data.ts:41` calls `ticket_check_in_v1`) | Website, normal, Opus | #1132 applied on prod | yes with 3 (different module) |
| 3 | My-tickets buyer screen (reads `my_tickets_v1`, shows QR) | Website, normal, Opus | #1134 applied on prod; QR payload agrees with #1131 | yes with 2 |
| 4 | `/expire` header-equality test (the session-expire call at `ticketingHandlers.ts:272` must send the same header set as checkout/refund; `ticketing.ts:26` says they send no version) | admin, tests-only, Sonnet | #1106 merged (it rewrites `stripePost` headers) | yes with 2/3 |
| 5 | Dispute / async webhook events: RPCs exist (`ticket_order_mark_disputed_v1`, `ticket_order_dispute_closed_v1`), async mapping at `stripe-webhook/index.ts:11`, but 0 such events ever received on prod; needs tests + sandbox trigger | admin, high-risk lane, Opus xhigh | #1106 merged (shared `_shared/ticketing.ts`) | NOT with 4 or 6 (same file) |
| 6 | Promo codes (schema + checkout change) | admin migration + Website, ARC-sized, Opus | 5 done; after go-live (not a launch blocker) | no: touches checkout reserve RPC |

Safe now in parallel: 1 and 4-prep (test design). After #1132/#1134 apply: 2 and 3 together.

## 5. Not verified

- `plans/ARC-ticketing.md` (owner machine only).
- Deployed edge-function source (not fetched via `get_edge_function`; findings 2 and 3 are inferred
  from timestamps and event rows).
- Secret names `TICKET_BOOKING_FEE_PENCE`, `TICKET_PREVIEW_ORIGIN`, `STRIPE_WEBHOOK_SECRET_THIN`
  (no read-only tool lists secrets).
- Vercel env values for the two flags and `VITE_TICKET_PREVIEW_ORIGIN` (api.vercel.com blocked).
- Whether the 2 Stripe accounts are test or live.
- Main-branch CI state in either repo (red-on-main column).
- Admin #1068 and #1081 contents.
- Whether ledger-sync tolerates the version drift in finding 4.
- The fix rounds on #1132/#1134/#1106 were not re-reviewed by me.

Coverage: 14 checklist items (steps 0-13), 8 with evidence in this session (0, 2, 3, 4, 8, 10, 12 via the
3 refunded TEST orders, 13); 6 rest on Stripe/Vercel dashboards or merges this session cannot read or do
(1, 5, 6, 7, 9, 11).
