# Brief: Tickets tab in the dancer app (option A), behind `publicTicketing` (OFF)

Lane: normal (Website only, no DB change). One branch, one PR. Flag stays OFF; the owner flips it.

## What to build (owner picked option A, 2026-11-14)
A new first tab "Tickets" at `/app/tickets` in `src/modules/dancer-app/`, shown only when `flags.publicTicketing` is on.
- Top: one QR at a time (medium), ticket type name, short backup code (`DoorCodeLine`), arrows and "Ticket k of N" for ALL N (remove the `ORDER_QR_CAP = 8` cap). Tap the QR for the full-screen door view (only that view shows event name and date). No buyer name or email anywhere.
- Under the QR: ONE slim amber bar: "Finish your profile to unlock the rest" + a "Start" button. Shown only to people whose profile is incomplete.
- "Start" opens a bottom sheet "What are you?" with six one-tap chips (Dancer, DJ, Teacher, Organiser, Videographer, Venue). An untouched pick sends nothing. Dancer hands off to the existing onboarding (`/app/welcome`). Other roles hand off to the existing role/claim flow; do not duplicate it. If a role cannot be saved today, park it with a clear "coming soon" line and list it in the PR.
- Rest of the screen: a blurred, view-only preview of Home. Other tabs stay openable but locked-marked (lock icon); the real screen shows blurred, and every action button opens the same bottom sheet. Nothing stays disabled without saying why.
- Order states move into the card from `TicketThanksPage.tsx`: loading, QR read failed (retry), pending (poll), failed, processing after 8 polls, no order on this device ("We couldn't find an order on this device. Your tickets are in your email.").
- Layout at 390x844 with NO scroll: QR on top, one slim bar, tabs at the bottom, smaller text. Explicit px tap targets (min 44px; phone html font is ~13.5px).
- `/tickets/thanks` is folded in: after payment the buyer lands on `/app/tickets?o=<order>`. Keep `/tickets/thanks` as a redirect to it (no dead links in emails already sent).

Prototype (option A markup): `docs/briefs/prototypes/teaser-option-a.html` is not in the repo; the key CSS is `.qrc .bar .btn .chips .blur .peek .tabs .lock::after .sheet`. Build with the real design tokens, not the prototype colours.

## Where it fits (verified on origin/main)
- `shell/routes.ts` is the single route table (`DancerRouteId`, `DANCER_TABS`). Add `tickets` as a deliberate edit (README says shell is "import; never edit" for screen slices, this is the one allowed exception).
- `shell/DancerAppRoutes.tsx`: `DANCER_SCREENS: Record<DancerRouteId, ComponentType>` needs an entry. Guards: `AuthGuard` -> `DancerAreaGate` -> `DancerAppShell`.
- Any new `/app/...` path must also be added to `src/components/catchallClientPaths.ts` (tested by `tests/catchallClientPaths.test.ts`).
- OPEN DESIGN POINT, you decide and write it in the PR: `DancerAreaGate` redirects a signed-in person with no dancer profile to `/account`. A ticket buyer must reach `/app/tickets` (and the blurred view-only tabs) without a dancer profile. Smallest safe change: let the gate admit signed-in users on the tickets route and the locked view-only screens, while every write path still enforces `profile_incomplete` server-side. Do NOT loosen access to anything that writes.
- Reuse, do not rewrite: `src/modules/tickets/` `OrderQrBlock.tsx`, `TicketQrCode.tsx`, `DoorCodeLine.tsx`, `fetchOrderQr`, `fetchMyTickets`, `orderStorage.ts`, polling in `TicketThanksPage.tsx`.
- The `qr_token` must never be logged, put in a URL or sent to analytics (comments in `MyTicketsPage.tsx`). A guest order is never linked to My tickets (`OrderQrBlock.tsx`).
- JSX entities: `&mdash;` `&hellip;` `&rsquo;`; no raw Unicode punctuation. Full weekday names in UI copy. British English.

## Out of scope
Magic link, confirm-email step, emails, door scanner, organiser sales/refunds, any migration (`supabase/migrations/` must not exist here), any flag flip.

## Done means
- `npm run pre-ship` green; unit tests via `node ~/.claude/bin/dell-run.mjs website <sha> -- npm run test:unit` only (never on this PC).
- Tests: route table has `tickets`; catchall path present; gate admits a no-profile buyer on the tickets route only; cap removed (N tickets give N arrows).
- A 390x844 walk (laptop-safe/laptop-walk) of: one ticket, three tickets, pending, failed, no-order, locked tab with sheet. Screenshots in the PR.
- PR body has "Verified on real data" (prod project `stsdtacfauprzrdebmzg`, read-only counts, no personal data, include lists over the 100-row API cap, e.g. orders with more than 8 tickets) and "Not verified".
- Classify as BUILD-visual; `/code-review` once before commit (access-gate change is a risky class).
