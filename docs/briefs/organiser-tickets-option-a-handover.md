# Handover: organiser Tickets option A (flag organiserTicketsA)

Done: flag `organiserTicketsA` (`VITE_ENABLE_ORGANISER_TICKETS_A`); clock model `tickets/a/clockState.ts` (before / door / after) with unit tests; `TicketsA.tsx` big-number screen + sheets Money, Who bought, Batches, Sell at the door; exit link wording "Back to bachatacalendar.co.uk" in V2Shell under the flag. Flag OFF = unchanged code paths.

Stubs (Coming soon, no writes): message buyers, did-not-come list, payout amount/date, auto-open next batch, Took cash (disabled). "See all" and "Change a price" open the existing Tickets entry (refund and price editor reused).

Left / next: 390x844 browser walk on prod-shaped data and screenshots; Money sheet payout copy; A6 "Open now" control; polish to the board spacing; the exit bar as a separate 44px white bar above the header (today it is the existing header link).

tsc run on branch head: 0 errors. Vitest: tickets/a and v2 suites pass. check:mojibake clean.
Not verified: browser walk, prod shape survey, pre-ship, full lint chain, CI.

## Continuation 1 (dt_4f42163780dc)
Done: exit bar as its own 44px white bar above the 48px header under the flag (`v2-exit`, 12px 500 #464646, chevron; flag off keeps the old header link); A6 "Open now" wired to existing `ticket_type_set_status_v1` (owner/manager only, next draft or paused batch; "opens by itself" sentence stays Coming soon); Money sheet payout line is "Coming soon" (no date or amount shown as fact).
Stubs still: message buyers, did-not-come list, payout date/amount, auto-open next batch, Took cash (disabled), sell at the door.
Left: 390x844 browser walk on prod-shaped data with screenshots; A1-A3 spacing check against the board HTML (44 + 48 + 64 budget); pre-ship; full lint chain; CI.
tsc (tsconfig.app.json) on this head: 0 errors in branch files (155 repo-wide, none in touched files). vitest src/modules/organiser/p3: 156 files pass. check:mojibake clean.
Not verified: browser walk, spacing, prod shape survey, pre-ship, lint chain, CI.
