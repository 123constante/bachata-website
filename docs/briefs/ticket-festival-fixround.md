# Brief: PR #1558 fix round (festival in-site tickets)

Repo 123constante/bachata-website, branch feat/ticket-festival-in-site (existing PR #1558, bot-authored: DO NOT open a new PR, DO NOT use MCP create_pull_request; just push to the branch). Read first: docs/design/ticket-festival-in-site.md, docs/briefs/ticket-festival-in-site.HANDOVER.md, tests/client/ticketFestivalPage.matrix.test.tsx, src/pages/FestivalDetail.tsx, src/modules/event-page/utils/festivalTicketing.ts, and merged PR #1556's `buildJsonLdOffers` in src/modules/event-page/utils/ticketOfferUrl.ts (merge origin/main first if #1556 is merged; otherwise read it from branch feat/ticket-jsonld-offers).

Owner aim: steer people to our in-site ticketing. Independent review of head 2aae833 returned PASS with these findings to fix (one round only):

1. Vacuous test (the last `it` in ticketFestivalPage.matrix.test.tsx, "a pass card opens the in-site tickets page"): fixture pass and ticket type are both "Full pass", so the assertion passes with no click effect. Make it fail if openTickets or the lazy FestivalTicketsPage import breaks: assert something only the tickets page renders; prove it red by temporarily breaking openTickets.
2. JSON-LD price mismatch: when in-site Buy is live, offers take prices from the organiser's `passes` but the url points at our page, whose checkout sells ticket_types at their own prices. When live, build the offers from the live ticket types (name, price, currency; use the LiveOffer/liveOffers path from #1556 if available), not from passes. Test: passes say 90 GBP, type 85 GBP -> offer price 85.
3. While the probe is pending the hero, pass cards and end CTA show the organiser's external link, then flip. The sticky bar already hides it in that window; do the same in those three places (no external link until the probe has answered), while still showing it for festivals that have no ticket types at all and after a "quiet" answer.
4. Live in-site sale but festival has no passes: JSON-LD must still carry offers from the live types (covered by 2); add a test for that shape.
Out of scope: finding about multi-night per-night types (note in the handover only).

Gates: targeted vitest for tests/client/ticketFestivalPage.matrix.test.tsx and tickets tests; tsc; build; flag-off behaviour unchanged. nightControls.matrix has 2 date-dependent failures that are also red on main (issue #1527): ignore, name them. Record Verified / Not verified in docs/briefs/ticket-festival-in-site.HANDOVER.md. Push once to the branch.
