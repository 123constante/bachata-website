# Handover: post-pay teaser, read-only dancer app (PR 2 of 2)

Brief: `docs/briefs/ticket-buyer-teaser.md` on branch `brief/ticket-buyer`. Flag: `VITE_ENABLE_TICKET_TEASER` (`TICKET_TEASER_ENABLED (screens/teaser/teaserFlag.ts)`, default OFF; also needs `flags.publicTicketing`). Zero migrations.

## Done
- `gate/viewOnly.ts`: `admitsViewOnly(path, ticketing, teaser)` also admits `/app/home|nights|me|options` view-only when the teaser flag is on (never edit, photo, page, welcome).
- `screens/teaser/`: pure model (`teaserModel.ts`), Calm CSS (`teaser.css`), read-only twins `TeaserHome/Nights/Me/Options`. They call no member RPC. Locked item = blur + centred gold chip; tap = one bottom sheet "Finish your profile to use this" (Continue to the existing onboarding entry, Not now).
- Home: one Finish card ("What are you?") + small "Your ticket" card (opens Nights). Nights: full ticket (existing `TicketCard`, large QR + door code) at the top.
- `DancerAppShell`: with the teaser active it draws the real four tabs (no Tickets tab, none locked; small lock mark on Me). `DancerAppRoutes` swaps in the twins only for a view-only buyer with both flags on. Flag off: no change.
- Tests: `screens/teaser/__tests__/teaserModel.test.ts`.
- Screenshots 390x844: `docs/handover/ticket-teaser-walk/` (home, nights, me, options, sheet), rendered in a throwaway harness (Vite, no auth), not the live shell.

## Left / next
- Walk the real signed-in shell with a prod-shaped view-only buyer (no ticket, pending order, failed order, 2+ tickets).
- Continue goes to `/app/welcome`; for a view-only buyer the gate sends that to `/account` (existing behaviour, onboarding is out of scope). Decide whether the gate should admit welcome when the teaser is on.
- Home greeting is "Hi there" (no name is read for a view-only buyer).
- Me tab lock mark is a visual only (as in the mockup).

## Open: bundle-budget (blocks CI, needs an owner decision)
- First CI run failed because `TeaserScreens` imported `tickets/cardKit` (lazy-TicketCard-only), which dropped the `/app/*` manifest entry. Fixed in `01f3191`+1 (own `nightDate` in `teaserModel.ts`, same words as `doorDate`, pinned by a test).
- With the entry back, local build (CI env): `/app/*` is 389.6 KB / 52 chunks vs main 379.8 KB / 48 (budget 381 / allowance 48). New first-load chunks vs main: `model`, `myTicketsApi`, `myTicketsModel`, `orderStorage`, `ticketCheckoutApi`.
- Tried making the four twins one lazy chunk (`lazyWithRetry` in `DancerAppRoutes`): the manifest entry is lost again (the lazy chunk shares `useTicketCard` and friends with the dancer-app chunk). Reverted.
- Next: either raise the `/app/*` row with a measured note in `perf-budgets.json` (as #1664 did), or find why the tickets modules left the dancer-app chunk (candidate: `TeaserScreens` importing `useTicketCard` + `tickets/model` statically alongside `TicketsScreen`).
