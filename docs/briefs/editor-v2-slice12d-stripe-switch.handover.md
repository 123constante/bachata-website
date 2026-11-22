# Editor v2 slice 12d handover (real Stripe sign-up + Switch how dancers pay)

Files: `TicketsV2.tsx` (onboarding, return handling, Switch flow), `PaySheets.tsx` (`SwitchPaySheet`), `copy.ts` (`ticketsPay` block), `__tests__/stripeSwitch.test.tsx` (new, 12 tests), `__tests__/paySheets.test.tsx` (the 12c "sold = no-op" test now expects the Switch sheet; mock gains `useStartOnboarding`).

| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 88 | Sell tickets here (big) | Tickets, no Stripe | real Stripe redirect (`useStartOnboarding(org, undefined, <v2 tickets path>)`; busy disables, error note and "not switched on" line shown) |
| 89 | Connect Stripe / return | back from Stripe | toast "Stripe connected" + selling state; `?stripe=` param cleared; one refetch |
| 90 | not connected on return (return or refresh) | Tickets | T-06 warning |
| 94s | Pay at the door, sold>0 | footer / How sheet | Switch sheet (door) |
| 97s | add a link, sold>0 | footer | Switch sheet (link) |
| 95 | Switch | Switch sheet | door action + Undo / Link sheet (saving link pauses on-sale types) |
| 96 | Keep selling | Switch sheet | closes, no write |
| 91, 92 | ticket sheet | | PENDING 13 |

Decisions:
- Stripe returns to `P3_PATHS.event(id) + '/tickets'` (the v2 route), not `?tickets=1`.
- Return handling: one refetch on arrival, no polling and no `useConnectReturn` (brief: no loop). A slow Stripe webhook can therefore show the T-06 box for a moment; the person can retry with the big button.
- The T-06 box now shows whenever `stripeWarn` is set (it is only set by a failed return), not only in `here` mode, because with no Stripe the mode is usually door.
- Sales not read = no-op (never switch blind). Sold tickets are never touched.

Verified: `npx vitest run src/modules/organiser/p3/v2`: 23 files, 293 pass. tsc run on HEAD: 0 errors. `npm run check:mojibake` clean.
Not verified: a real Stripe round trip (cannot run here); 390x844 walk; pre-ship; /code-review; prod data-shape survey; real `ticket_type_set_status_v1` RPC (mocked). No PR (per brief).
