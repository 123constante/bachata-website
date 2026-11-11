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
