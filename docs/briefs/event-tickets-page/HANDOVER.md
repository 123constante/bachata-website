# HANDOVER: event-tickets-page (PARTIAL, slices a-c done)

## Done
- INVENTORY.md; `goodToKnow.ts`, `ticketSymbol.ts` + tests (earlier).
- (a) Venue read: `parking`, `id_required`, `cloakroom_available`, `bar_available` parsed in types.ts / useEventPageQuery.ts / buildEventPageModel.ts. FINDING: the `event_view_p5` RPC does NOT return these four fields today (checked with a read-only pg_get_functiondef), so those chips stay hidden until the admin repo adds them to the venue JSON. No DB change made here.
- (b) `EventTicketsPage.tsx`: full-screen page (portal, Back button uses history), title + date line, Good to know chips (`ChipRow`), then the unchanged `TicketsBlock` (no change to ticketCheckoutModel.ts). Ticket rows now have 64px symbol tiles (`ticketSymbol`), amber #FF9900 buy button.
- (c) Sticky bar `Buy tickets` calls `onOpenTickets`; inline `TicketsBlock` mount removed from BentoPage. `flagOff.test.ts` updated to the new mount.
- Tests: `eventTicketsPage.matrix.test.tsx` (latest close, chip shapes).

## Left
1. Programme block (max 4 items, "See full programme") on the Tickets page; chips length fallback from programme (`programmeStartIso/EndIso` are passed null today).
2. Amber fixed bottom bar and quiet dark-green bar for non-actionable states (button is amber inline, not a fixed bar); quantity pill styling.
3. (d) Thanks page: one QR per ticket; My tickets find-by-email form.
4. 390x844 walk (laptop-walk.mjs --branch), full CI steps, lint chain, e2e.
5. Admin repo: add the four venue fields to `event_view_p5`.

## Not verified
No browser walk, no e2e, lint chain not run (eslint on touched files: 2 pre-existing errors in EventStickyActionBar.tsx, not from this change). Unit tests in src/modules/tickets and src/modules/event-page pass. tsc run on 3a10a8b: 0 errors in branch files.
