# Handover: Option A Tickets tab (dt_3a0b4a1786bb)

Branch `claude/option-a-tickets-tab`. Brief: `brief/option-a-tickets-tab:docs/briefs/option-a-tickets-tab.md`.
Flag `publicTicketing` stays OFF; with it OFF nothing visible changes (the route sends you to Home, the thank-you page is unchanged).

## Done
- `/app/tickets`, the first tab while the flag is on (`shell/routes.ts` `TICKETS_TAB`, `shellTabs`; `DANCER_TABS` is unchanged). The path is in the catchall list.
- QR card (`screens/tickets/TicketCard.tsx`, lazy): one QR, arrows, "Ticket k of N" for ALL N (no cap), tap for the full-screen door view (the only place with event name and full-weekday date). Order states: loading, pending, processing (still pending after 8 polls, or an unknown reading), failed (with a link back to the event), QR read error (retry), paid but no QR rows (confirmed, in your email), no order on this device.
- Amber bar, blurred Home preview, locked tabs, and the "What are you?" sheet (`shell/profileSheet.tsx`). Chips link to the existing flows: Dancer to `/app/welcome?returnTo=/app/tickets`, Organiser to `/account/o`, Teacher to `/account/t`, DJ to `/account/dj`. Videographer and Venue are PARKED as "coming soon" (there is no flow for them today). Dancer is also parked for a view-only visitor.
- Gate decision (`gate/viewOnly.ts`, `DancerAreaGate.tsx`): `allowed` means the dancer AREA is open to this person (global flag OR allow-list), not "has a profile". With the flag on, a not-allowed signed-in person may open `/app/tickets` only, as view-only. Every other `/app` path still redirects to `/account`. Locked tabs open the sheet and never mount a member screen. A failed gate read admits to tickets but is not view-only.
- `/tickets/thanks`: NOT redirected in this PR. The redirect needed edits to `src/modules/tickets/` (TicketThanksPage, a shared poll hook), which are not dancer-area seams, so they were reverted (isolation rule a). The Tickets tab has its own copy of the poll at `screens/tickets/useOrderStatus.ts`. Follow-up (orchestrator decision): list `TicketThanksPage.tsx` as a seam, then redirect a signed-in buyer (flag on) to `/app/tickets?o=`.
- Tests: `tests/client/dancerTicketsTab.test.tsx`. The flag-on browser walk spec was removed from the PR (listing it needed a non-seam edit to `scripts/check-e2e-spec-coverage.mjs`); its 390x844 screenshots are in `docs/handover/option-a-tickets-tab/`.

## Left / next
- Tabs are locked only for a person with no dancer profile (view-only or `no_profile`). A dancer part-way through setup sees only the bar.
- The locked tab opens the sheet. It does NOT show the real screen blurred: those screens call member RPCs that refuse a not-allowed person.
- `OrderQrBlock` (the guest thank-you page) keeps `ORDER_QR_CAP = 8`. The new card has no cap.
- The stored-id and state derivation are still repeated between `TicketThanksPage` and `useTicketCard` (review finding 8). Folding them into one `useOrderState` is a follow-up.
- Owner: flip `VITE_ENABLE_PUBLIC_TICKETING`, then do the phone test.

PR: #1664. Fix-1664-reds: bundle-budget row re-measured (TicketCard no longer imports from the dancer-app chunk; budget 376 -> 381 KB, chunks 46 -> 48, see perf-budgets.json note), isolation violations removed.
