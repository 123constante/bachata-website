# Inventory: public event page buy area (brief public-ticket-lead)

Audit read first: `claude/walk-ticket-connect-flow` docs/walk/ticket-connect-flow/RESULTS.md. Gap G1 (external link beats in-site tickets) is this slice; G9 (both paths) is touched.
Admin app: NOT readable from this session (only bachata-website is attached), so the admin column is "not inspected". Only what the Website reads is quoted.

| # | Field / state / option | Admin (writes it) | Website reads (file:line, main 502dddf) | Public page today |
|---|---|---|---|---|
| 1 | External ticket link | not inspected | `pageModel.actions.ticketUrl` BentoPage.tsx:634, 841-845 (null when ended / cancelled / paused) | Sticky bar primary "Get Tickets" EventStickyActionBar.tsx:148-160 |
| 2 | Ticket types for the series | not inspected | `fetchPublicTicketTypes` -> `ticket_types_public_v1` ticketCheckoutApi.ts:41-47 | TicketsBlock only |
| 3 | Type status on_sale / sold_out | not inspected | `parsePublicTypes` ticketCheckoutModel.ts:46-60 (other statuses dropped) | Block rows |
| 4 | Sales window (open / close) | not inspected | `availability` ticketCheckoutModel.ts:95-102 (not_yet, closed) | Row label |
| 5 | Stock `remaining` | not inspected | `availability` :96, `maxQuantity` :110 | "N left" under 20 |
| 6 | Price 0 (free ticket) | not inspected | `totals` :126-128 | Free path `result.kind==='free'` TicketsBlock.tsx:184 |
| 7 | Per-night types | not inspected | `typesForNight` :105 | Block filters by night |
| 8 | Flag `publicTicketing` | n/a | BentoPage.tsx:760 | Gates block (now also the bar's fetch) |
| 9 | Night bookable (not over / cancelled / paused) | not inspected | BentoPage.tsx:760, 841-845 | Gates block and link |
| 10 | Buy block anchor | n/a | none | NEW `id="tickets"` TicketsBlock.tsx |
| 11 | "Sells in-site now?" | n/a | none (G1) | NEW `sellsInSite` ticketCheckoutApi.ts, read by bar and block |

Coverage: 11 rows; 11 covered by code or by an explicit "not inspected" for the admin column. Admin-side column coverage: 0 / 11 (repo not attached).
