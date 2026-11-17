# Handover: organiser Tickets option A (flag organiserTicketsA)

Done: flag `organiserTicketsA` (`VITE_ENABLE_ORGANISER_TICKETS_A`); clock model `tickets/a/clockState.ts` (before / door / after) with unit tests; `TicketsA.tsx` big-number screen + sheets Money, Who bought, Batches, Sell at the door; exit link wording "Back to bachatacalendar.co.uk" in V2Shell under the flag. Flag OFF = unchanged code paths.

Stubs (Coming soon, no writes): message buyers, did-not-come list, payout amount/date, auto-open next batch, Took cash (disabled). "See all" and "Change a price" open the existing Tickets entry (refund and price editor reused).

Left / next: 390x844 browser walk on prod-shaped data and screenshots; Money sheet payout copy; A6 "Open now" control; polish to the board spacing; the exit bar as a separate 44px white bar above the header (today it is the existing header link).

tsc run on branch head: 0 errors. Vitest: tickets/a and v2 suites pass. check:mojibake clean.
Not verified: browser walk, prod shape survey, pre-ship, full lint chain, CI.
