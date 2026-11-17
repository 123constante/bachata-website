# Handover: post-pay teaser, read-only dancer app (PR 2 of 2)

Brief: `docs/briefs/ticket-buyer-teaser.md` on branch `brief/ticket-buyer`. Flag: `VITE_ENABLE_TICKET_TEASER` (`TICKET_TEASER_ENABLED (screens/teaser/teaserFlag.ts)`, default OFF; also needs `flags.publicTicketing`). Zero migrations.

## Done
- `gate/viewOnly.ts`: `admitsViewOnly(path, ticketing, teaser)` also admits `/app/home|nights|me|options` view-only when the teaser flag is on (never edit, photo, page, welcome).
- `screens/teaser/`: pure model (`teaserModel.ts`), Calm CSS (`teaser.css`), read-only twins `TeaserHome/Nights/Me/Options`. They call no member RPC. Locked item = blur + centred gold chip; tap = one bottom sheet "Finish your profile to use this" (Continue to the existing onboarding entry, Not now).
- Home: one Finish card ("What are you?") + small "Your ticket" card (opens Nights). Nights: full ticket (existing `TicketCard`, large QR + door code) at the top.
- `DancerAppShell`: with the teaser active it draws the real four tabs (no Tickets tab, none locked; small lock mark on Me). `DancerAppRoutes` swaps in the twins only for a view-only buyer with both flags on. Flag off: no change.
- Tests: `screens/teaser/__tests__/teaserModel.test.ts`.
- Screenshots 390x844: `docs/handover/ticket-teaser-walk/` (home, nights, me, options, sheet), rendered in a throwaway harness (Vite, no auth), not the live shell.

## Fix round 1 (done)
- bundle-budget: teaser twins + TicketsScreen are lazy chunks. They imported the dancer-app entry chunk (shared `tickets/model`, `teaserModel`), which dropped its manifest entry. Split pure shell-shared parts into `tickets/profileIncomplete.ts`, `tickets/roleChips.ts`, `teaser/teaserGate.ts` (old modules re-export); `TeaserOptions` gets `SignOutControl` as a prop. Result: /app/* 376.5 KB / 47 chunks (main 379.8 / 48); allowance tightened 48 -> 47 in `perf-budgets.json`. `check:bundle-budget` and `check:first-load-requests` pass locally. Main was not checked for red (no CI read access here).
- Gate admits `/app/welcome` for a view-only buyer only with the teaser flag on (test added). Onboarding untouched.
- Home greeting uses `user_metadata.first_name` (`greetingFor`), else "Hi there".

## Left / next
- Walk the real signed-in shell with a prod-shaped view-only buyer (no ticket, pending, failed, 2+ tickets): not reachable read-only here. Welcome for a view-only buyer then reaches onboarding, whose saves were never tested for this person: check on a phone before turning the flag on.
- Me tab lock mark is a visual only (as in the mockup).
- tsc: 2 pre-existing errors in `screens/tickets/__tests__/ticketsScreen.test.tsx` (VitestUtils typing), untouched. eslint errors only in untouched files.
