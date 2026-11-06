# Arc: ticketing (free + paid tickets, Stripe Connect, door check-in)

Last verified: 2026-11-06 against Website origin/main a8c7b7d00 and admin origin/main 514fb0ab, with `gh pr view`. Sources: plans/ARC-ticketing.md, READY-QUEUE.md rows 12, 51, 52, 67, 68. PR numbers: `W#` = bachata-website, `A#` = bachata-admin (separate sequences).
Goal: an organiser sells or hands out tickets for their own event and the buyer gets a QR for the door. Flags `organiserTicketing` and `publicTicketing` (src/lib/featureFlags.ts) stay OFF on the live site until the owner's go-live phone walk passes (checklist merged as W#1403).

## Slices
| Slice | Repo | Status | Blocked by | PR / branch / brief |
|---|---|---|---|---|
| S0 P1 schema, S1 P2 hardening, S1b offsite backup, S1c rate fold | admin | DONE, applied | -- | A#1063, A#1070, A#1079, A#1080 |
| S2 edge functions + Stripe Accounts v2 | admin | DONE, deployed (test mode) | -- | A#1093, A#1106 |
| S3 organiser UI, S4 buyer checkout | web | DONE, behind flags | -- | W#1060, W#1063, W#1075; P3 W-T W#1079 |
| Thank-you page reads order status | both | DONE | -- | A#1105, W#1121, W#1382 |
| Remove the 50p booking fee | web | DONE | -- | W#1135, W#1390 |
| My tickets + door QR | both | DONE | -- | A#1134, A#1222, A#1131, W#1334, W#1341, W#1359 |
| Promo codes (organiser + buyer) | web | DONE | -- | W#1366, W#1372, W#1387 |
| Door check-in RPCs + scanner | both | DONE | -- | A#1123, src/modules/organiser/p3/door/DoorScreen.tsx |
| Dispute + async payment events | admin | DONE | -- | A#1234 |
| Buyer short door code, DB half | admin | DONE, merged 2026-11-06 14:57Z, applied by CI | -- | A#1281 (queue row 51) |
| Buyer short door code, web half | web | NOT ON A BRANCH: first worker ended with a blocked marker | confirm A#1281 is live on prod, then re-dispatch | brief/ticket-buyer-short-code-web (100b02fc); marker W#1446 (dt_868315ad3d0c, "prerequisites absent on main"); queue row 52 still says RUNNING, lead to reconcile |
| Organiser sales report card + guest list CSV | web | IN FLIGHT, PR open, checks not re-read | review, checks, owner Approve if hard tier | W#1445 claude/ticket-sales-report-web (2ebafa32); brief/ticket-sales-report-web |
| Partial refund in the refund edge function | admin | IN FLIGHT, PR open; `unit-build` and `rpc-body-snapshots` red when last read | fix round, review; lead deploys the edge function after review | A#1283 claude/ticket-partial-refund-edge (c5e348ef); brief/ticket-partial-refund-edge |
| Go-live phone walk of the checklist | owner | WAITING-OWNER | owner | W#1403 docs (merged) |

## Slices not yet briefed (drafters: pick from here, verify each on origin/main first)
| Item | Repo | Blocked by | Source |
|---|---|---|---|
| Partial refund UI: amount field on the organiser Refund sheet (order stays paid, tickets stay valid) | web | A#1283 merged and deployed | plans/ARC-ticketing.md decision Q5 |
| Ticket branch of the shared door scanner (`door_scan_v1` parses `t:` and `r:`) once raffle R5 starts | both | raffle R1 applied (docs/arcs/raffle.md) | plans/before-you-plan-or-quizzical-graham.md "RPCs" |
| Remove TICKET_PREVIEW_ORIGIN Supabase secret before live (owner/lead task, not a worker) | ops | go-live decision | ARC-ticketing S5 note |
| Plus-address email folding before a public sale (O2) | admin | none known | ARC-ticketing "Open follow-ups" |
| Restore drill of the nightly backup into a throwaway DB | ops | Dell docker access or a throwaway DB | ARC-ticketing 10-28 19:50 |

## Owner decisions pending
- Go-live (S6 live Stripe secrets, Vercel Hobby terms flag, flags ON) and the first friendly organiser (Q8: own event first, then one organiser). Not a worker task.
- Whether leftover test orders and the two "delete me" ticket types in prod are cleaned before go-live (decided "leave for now" 2026-10-28; revisit before S6).
- Owner phone walk (W#1403 checklist) is the final check; nothing else gates it.

## Rules for briefs in this arc
- Admin owns all SQL and edge functions (Website has zero migrations). Money paths are careful lane, Opus builds, a different model reviews.
- Every ticket screen needs the status x type x counts matrix (free, paid, sold out, paused, refunded, voided, huge).
- Ticket QR payload is `t:<token>`; raffle QR is `r:<token>`; one scanner reads both.

## Not verified here
- Prod state of A#1281 beyond the queue note (ledger 20270315070000); whether the short_code columns in src/integrations/supabase/types.ts are the ones the web half needs.
- Checks on W#1445 and A#1283 beyond the red list above; Stripe live mode (never touched); dispute events in the real Stripe dashboard.
