# Handover: ticket-festival-in-site (dt_a7b0cc15e215)

Branch `feat/ticket-festival-in-site`. Design record: docs/design/ticket-festival-in-site.md.

## Done
- FestivalDetail wired to the event pages' in-site path: sticky bar probe (`inSiteTicketing`, festival night, `onTicketingLive`, `onOpenTickets`), lazy `FestivalTicketsPage` -> `EventTicketsPage`. Live: "Buy tickets" on bar/hero/pass cards/end CTA, organiser link nowhere. Not live: page unchanged (quiet bar + "Tickets elsewhere").
- JSON-LD offers use `ticketOfferUrl` (reused, not forked).
- Pure helper `src/modules/event-page/utils/festivalTicketing.ts`.
- Matrix test `tests/client/ticketFestivalPage.matrix.test.tsx` (10 cases on the real page); red on main (6 fail), green here.
- Chunk ratchet kept at 39 on /event: `ticketOfferUrl` pinned in lib-event-rules (vite.chunks.ts + tests/chunkClassifier.test.ts); the wrapper uses empty programme hooks (type-only import of EventScheduleGrid).
- Prod shape survey (read-only) in the design record.

## Left / next steps
1. 390x844 browser walk with screenshots on the PR (not done: context budget). Ritmo via the walk harness, flag `publicTicketing` on.
2. `/code-review` round(s) before merge (not run).
3. Stripe test-mode order on Ritmo: lead's step after merge (needs `publicTicketing` on in a preview + test card).
4. Pre-existing reds, also on main: src/modules/tickets/__tests__/nightControls.matrix.test.tsx (2 FIX-3 cases), tests/integrityCouldNotRun.test.ts (sandbox), live-DB contract tests (no DB creds here).

## Fix round (dt_66858322325e), review of 2aae833
Brief: docs/briefs/ticket-festival-fixround.md (branch brief/feat/ticket-festival-in-site).
1. Vacuous pass-card test fixed: pass ("Organiser weekend pass") and type ("In-site weekender") differ; asserts `[data-testid="event-tickets-page"]` absent before the click, present after, and containing the TYPE name. Proven red by breaking `openTickets` (`setTicketsOpen(false)`): 1 failed.
2. JSON-LD live offers = live ticket types at their own price (`festivalJsonLdOffers` in festivalTicketing.ts). #1556 was NOT merged, so its probe -> bar -> page `LiveOffer[]` path was ported verbatim from `feat/ticket-jsonld-offers` (EventStickyActionBar, InSiteTicketProbe, ticketCheckoutApi `liveOffers`, ticketOfferUrl `buildJsonLdOffers`, nightControls test arg) -- identical hunks, so #1556 should merge cleanly on top. BentoPage untouched here. Test: passes 90 GBP, type 85 GBP -> offer price "85.00".
3. Probe pending: new bar prop `onTicketingPending`; page `ticketCta` gains `'pending'` (only when her link exists): invisible same-size placeholder on hero + end CTA, pass cards unlinked. Returns after quiet / no types / failure / timeout. Flag off: no pending window (test).
4. Live with no passes: offers from the live types (test).
Red on unfixed code: the 3 new behaviour tests fail on 2aae833 (JSON-LD x2, pending), pass here.

### Verified
- `vitest tests/client/ticketFestivalPage.matrix.test.tsx`: 14/14.
- `vitest src/modules/tickets + ticketFestivalPage + ticketLeadPage + chunkClassifier`: 887 pass, 2 fail = the known date-dependent nightControls.matrix FIX-3 cases ("EventStickyActionBar forwards occurrenceId to the probe", "InSiteTicketProbe with occurrenceId n1 fetches (e1, n1)"), also red on main (issue #1527).
- `npm run build` ok; `check-first-load-requests` all 6 routes at pin; `check-bundle-budget` ok; `check:mojibake` clean.
- tsc (`tsc -p tsconfig.app.json --noEmit`): 0 errors in files changed this round except pre-existing FestivalDetail.tsx:2545 (`meta_data`, also on main).

### Not verified
- tsc: `FestivalTicketsPage.tsx(21)` errors because main's `EventTicketsPageProps` lacks `programHooks` (same error in EventTicketsPage.tsx:100 and BentoPage.tsx:822 on main); not fixed here.
- No 390x844 browser walk, no `/code-review` round, no prod re-survey this round (survey in the design record is from 2026-11-11).
- Out of scope (noted per brief): multi-night festivals with per-night types -- the page probes only the snapshot's one night; no prod festival has per-night types or >1 occurrence today.
