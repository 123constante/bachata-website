# INVENTORY P89 (worker notes, GetPaidBody states x returnTo shapes)

All in `src/modules/organiser/p3/tickets/GetPaid.tsx` (GetPaidContent/GetPaidBody), original line numbers on main.

| # | Item | Where | Covered by |
|---|------|-------|-----------|
| 1 | Stripe none/started/waiting/connected | GetPaidBody (`useStripe`) | returnTo x stripe matrix |
| 2 | owner / non-owner | `isOwner`, `canGo` | non-owner back link test |
| 3 | switchedOff | `useStartOnboarding` | unchanged path, existing getPaid.matrix |
| 4 | busy / note | `useStartOnboarding` | unchanged, existing getPaid.matrix |
| 5 | stripe=return / refresh arrival | GetPaidContent `returnKindOf` | arrival test |
| 6 | returnTo: event path | `readReturnTo` | matrix |
| 7 | returnTo: go-live?series= (event label) | `returnToSeriesId` | label test |
| 8 | returnTo: non-event organiser path (Go back) | `GO_BACK_LABEL` | label test |
| 9 | returnTo: https://, //, Done (rejected) | `sanitizeReturnTo` | unsafe tests |
| 10 | no returnTo | | unchanged-URLs test |
| 11 | Stripe return/refresh URLs carry returnTo | `P3_TICKET_PATHS.stripeBack` | Connect test |

Coverage: 11/11. Admin app and public page have no Get paid back link (Website-only screen).
