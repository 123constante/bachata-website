# Handover: Option A Tickets tab (dt_3a0b4a1786bb)

Branch `claude/option-a-tickets-tab`. Brief: `brief/option-a-tickets-tab:docs/briefs/option-a-tickets-tab.md`.
Flag `publicTicketing` stays OFF; with it OFF nothing visible changes (the route sends you to Home, the thank-you page is unchanged).

## Done
- `/app/tickets`, the first tab while the flag is on (`shell/routes.ts` `TICKETS_TAB`, `shellTabs`; `DANCER_TABS` is unchanged). The path is in the catchall list.
- QR card (`screens/tickets/TicketCard.tsx`, lazy): one QR, arrows, "Ticket k of N" for ALL N (no cap), tap for the full-screen door view (the only place with event name and full-weekday date). Order states: loading, pending, processing (still pending after 8 polls, or an unknown reading), failed (with a link back to the event), QR read error (retry), paid but no QR rows (confirmed, in your email), no order on this device.
- Amber bar, blurred Home preview, locked tabs, and the "What are you?" sheet (`shell/profileSheet.tsx`). Chips link to the existing flows: Dancer to `/app/welcome?returnTo=/app/tickets`, Organiser to `/account/o`, Teacher to `/account/t`, DJ to `/account/dj`. Videographer and Venue are PARKED as "coming soon" (there is no flow for them today). Dancer is also parked for a view-only visitor.
- Gate decision (`gate/viewOnly.ts`, `DancerAreaGate.tsx`): `allowed` means the dancer AREA is open to this person (global flag OR allow-list), not "has a profile". With the flag on, a not-allowed signed-in person may open `/app/tickets` only, as view-only. Every other `/app` path still redirects to `/account`. Locked tabs open the sheet and never mount a member screen. A failed gate read admits to tickets but is not view-only.
- `/tickets/thanks`: a signed-in buyer (flag on) is redirected to `/app/tickets?o=` (and `free=1`). Guests keep the old page, because `/app` is signed-in only. It waits for auth to resolve. The poll is shared through `tickets/useOrderStatus.ts`.
- Tests: `tests/client/dancerTicketsTab.test.tsx` (44 cases). Walk: `tests/e2e/dancer-app/tickets-walk.spec.ts` (manual, flag-on build). Screenshots: `docs/qa/option-a-tickets-tab/`.

## Left / next
- Tabs are locked only for a person with no dancer profile (view-only or `no_profile`). A dancer part-way through setup sees only the bar.
- The locked tab opens the sheet. It does NOT show the real screen blurred: those screens call member RPCs that refuse a not-allowed person.
- `OrderQrBlock` (the guest thank-you page) keeps `ORDER_QR_CAP = 8`. The new card has no cap.
- The stored-id and state derivation are still repeated between `TicketThanksPage` and `useTicketCard` (review finding 8). Folding them into one `useOrderState` is a follow-up.
- Owner: flip `VITE_ENABLE_PUBLIC_TICKETING`, then do the phone test.

PR: #1664. tsc run on the final commit: 0 errors in branch files.
