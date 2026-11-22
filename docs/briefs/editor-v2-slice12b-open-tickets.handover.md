# Editor v2 slice 12b handover (open the Tickets screen)

Wiring: `EditorV2` calls `useNavigate` and passes `onOpenTickets` (path `P3_PATHS.event(id) + '/tickets'`, the same prefix as the route `events/:seriesId/tickets`) to `NightCard` and `EveryBody`. Both take an optional `onOpenTickets` and pass it to the Price fact's `onOpen`. No router inside them. `priceLabel` inputs are unchanged.

| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 22 | Price ... Change > | Every card -> Tickets screen | prototype |
| 22n | Price ... Change > | Night card -> Tickets screen | prototype |
| 27 | Tickets (Prices and how dancers pay) | one-off event | NOT BUILT as a separate row. `EveryBody` is rendered for weekly events only (the Every tab exists only when weekly), so there is no one-off "Repeats" row to replace there. A one-off event shows `NightCard`, whose Price fact (22n) already opens the Tickets screen. A "Tickets / Prices and how dancers pay" line would go in the one-off body of `NightCard` (or `NightHub`) in a later slice if the owner wants the extra row. |
| 87 | back link on Tickets screen | first screen | prototype (test with MemoryRouter) |

Verified: new `__tests__/openTickets.test.tsx` (6 tests: both cards call the prop, no prop = no throw, shell navigates from night and Every tab, back link); `vitest run src/modules/organiser/p3/v2`: 21 files, 271 pass.
tsc run on HEAD: 0 errors in branch files (eventPage.proto.test.ts has 1 pre-existing error).
Not verified: 390x844 walk, pre-ship, /code-review, prod data-shape survey, one-off tap 27 row (see table). No PR (per brief).
