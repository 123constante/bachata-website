# Handover: post-pay teaser, read-only dancer app (PR 2 of 2)

Brief: `docs/briefs/ticket-buyer-teaser.md` on branch `brief/ticket-buyer`. Flag: `VITE_ENABLE_TICKET_TEASER` (`TICKET_TEASER_ENABLED (screens/teaser/teaserFlag.ts)`, default OFF; also needs `flags.publicTicketing`). Zero migrations.

## Done
- Gate untouched (`gate/viewOnly.ts`, `DancerAreaGate.tsx` as on main): the teaser never admits a not-allowed person anywhere new.
- Who sees it (`teaser/teaserGate.ts` `teaserState`): a signed-in person the dancer gate ALLOWS whose profile is unfinished (`no_profile`, or required steps not done), both flags on. Never view-only: their onboarding calls raise `42501 area_closed`. While the profile read is out, the tab draws nothing (no flash); a failed read = the real screens.
- `screens/teaser/`: pure model (`teaserModel.ts`), Calm CSS (`teaser.css`), read-only twins `TeaserHome/Nights/Me/Options`. They call no member RPC. Locked item = blur + centred gold chip; tap = one bottom sheet "Finish your profile to use this" (Continue to the existing onboarding entry, Not now).
- Home: one Finish card ("What are you?") + small "Your ticket" card (opens Nights, carrying `?o=` / `free=1`). The card line says "Your ticket is booked" only when real tickets are on the card; otherwise "Next step: tell us what you are." Never "bought" (free tickets). Nights: full ticket (existing `TicketCard`, large QR + door code) at the top.
- `DancerAppShell`: computes `teaserState` from its existing profile read and provides it (`TeaserContext`); with the teaser on it draws the real four tabs (no Tickets tab, none locked; small lock mark on Me). `DancerAppRoutes` swaps in the twins when that state is `on`. Flag off: no change.
- Tests: `screens/teaser/__tests__/teaserModel.test.ts`.
- Screenshots 390x844: `docs/handover/ticket-teaser-walk/` (home, nights, me, options, sheet), rendered in a throwaway harness (Vite, no auth), not the live shell.

## Fix round 1 (done)
- bundle-budget: teaser twins + TicketsScreen are lazy chunks. They imported the dancer-app entry chunk (shared `tickets/model`, `teaserModel`), which dropped its manifest entry. Split pure shell-shared parts into `tickets/profileIncomplete.ts`, `tickets/roleChips.ts`, `teaser/teaserGate.ts` (old modules re-export); `TeaserOptions` gets `SignOutControl` as a prop. Result: /app/* 376.5 KB / 47 chunks (main 379.8 / 48); allowance tightened 48 -> 47 in `perf-budgets.json`. `check:bundle-budget` and `check:first-load-requests` pass locally. Main was not checked for red (no CI read access here).
- (Superseded by fix round 2) Gate admitted `/app/welcome` for a view-only buyer.
- Home greeting uses `user_metadata.first_name` (`greetingFor`), else "Hi there".

## Fix round 2 (review `docs/review/pr-1753-review.md`)
- F1: keyed on an unfinished profile for an allowed person (prod `dancer_area_open = true`, so view-only never happens); welcome and tab admissions removed from the gate.
- F2: "bought" copy gone; "booked" only with real tickets on the card.
- F3: Home's ticket link carries `?o=` (and `free=1`) to Nights.
- F4: gone with F1 (the gate is as on main).
- Choice made (smallest, matches rule 4 "Unfinished onboarding: Finish your profile card on the dashboard"): the teaser does not separately check that a ticket exists; an allowed person with an unfinished profile and no ticket sees it with the neutral line.

## Left / next
- Walk the real signed-in shell with a prod-shaped allowed buyer with an unfinished profile (no ticket, pending, failed, 2+ tickets) before turning the flag on. A `no_profile` account's Continue reaches `/app/welcome`, which cannot create a profile (same as the existing Option A sheet): check on a phone.
- Me tab lock mark is a visual only (as in the mockup).
- tsc: 2 pre-existing errors in `screens/tickets/__tests__/ticketsScreen.test.tsx` (VitestUtils typing), untouched. eslint errors only in untouched files.
