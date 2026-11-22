# Editor v2 slice 5 handover (Going card, tiles, Raffle row, Share this night)

## Built
- `v2/NightHub.tsx` (new): `NightHub` (going card, two tiles, group "This night" / "On the night" with the Raffle row and a `children` slot after it, Share button + line), `ShareSheet` (uses `V2Sheet`), `gbp`.
- `EditorV2.tsx`: renders `<NightHub/>` after `<NightCard/>` on the night tab; a local `useState` plain toast (no Undo) feeds `V2Toast` (saveNow.ts untouched). Also removed the duplicate import lines left on the branch (they were TS2300 errors).
- `copy.ts` (+13), `v2.css` (+19, under `.ev2`), `__tests__/nightHub.test.tsx` (9 tests).

## Assumptions
- Initials: the going read carries `first_name` per person, so the card shows up to 3 initials then "+N".
- Going card is also hidden when the night is cancelled or has 0 going (nothing to open); otherwise same gating as `P3NightGoing` (`p3GoingOn()` outside the hook, `p3GoingSlot`, `p3NightOf` by occurrence id).
- Raffle: loading shows nothing; error / refused shows the row with no pill; night with no raffle info shows the row with no pill. `RaffleSheet` gets a minimal `Night` (seriesId, date, dayLabel) built in EditorV2; it reads the same series query.
- Share link: `origin + /event/<publicEventRefOf(series)>` (helper `publicEventRefOf` in `data/home.ts`, same scheme as `dash/shareLinks.nightLinkOf`), plus `?occurrenceId=<night id>` on a weekly event so each date chip gives its own link (same form as `eventHref`). Button disabled if no ref.
- Tiles show 0 / £0 until slice 15 supplies `ticketsSold` / `moneyPence`.

## TAP TABLE
| # | Button | Destination | prototype/OLD |
|---|---|---|---|
| 15 | 23 going | the going list as today (sheet) | prototype stub, built as today's screen (registry) |
| 18 | Raffle | today's RaffleSheet, switch inside | prototype stub, built as today's screen (registry) |
| 20 | Share this night | Sheet "Share this night" | prototype |
| 66 | Copy link | toast "Link copied"; blocked: "Select the link to copy it" | prototype |

## Verified / Not verified
- Verified: `npx vitest run src/modules/organiser/p3/v2` 10 files, 122 tests pass; `tsc -p tsconfig.app.json`: 0 errors in files I touched (one pre-existing error in `__tests__/eventPage.proto.test.ts`).
- Not verified: 390x844 browser walk, prod shape survey, pixel match, `pre-ship`, `/code-review`. Flag stays OFF.
