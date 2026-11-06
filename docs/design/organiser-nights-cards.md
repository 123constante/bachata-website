# Design record: organiser page nights cards

Brief: `docs/briefs/organiser-nights-cards.md` (branch `brief/organiser-nights-cards`). Owner decisions of 2026-11-06 are final.

## Chosen design
- **Next nights: direction D4.** Flyer left (50% wide, 200px tall), countdown chip on the flyer bottom-left, right column: gold uppercase full weekday, serif day number with month, serif title (two lines max), venue line, 44px gold action row with chevron. The whole card is one tap target: a link for a single night, a button opening the existing `SeriesDatesSheet` for a series of 3+ dates.
- **Past nights: highlights strip (option 2).** "N nights hosted", "N this year", up to six latest flyers (newest first), year shortcut chips ("2026 (12)"), and "See all N nights" (only when more than six). The full year-grouped list is unchanged and sits behind the button or a year chip.
- Pure logic lives in `src/modules/profile/nightsCardModel.ts`; components are `NightsCard.tsx` and `PastHighlights.tsx`. `EventRow.tsx` and `SeriesDatesSheet.tsx` are untouched (the sheet still uses `EventRow`).

## Decisions worth knowing
- Chip wording is the page's existing countdown rules. No "this week" or "THIS SUNDAY" flag was invented. Over 26 weeks: "in N months" (6 to 9), then "Mon YYYY". Never over 11 characters (tested for 1,500 day counts). Solid gold at 7 days or fewer, dark with gold border otherwise.
- Section heading stays as it is on main ("Upcoming events"); the brief calls it "Next nights" but the brief did not ask for a rename, so it was not changed.
- With six or fewer past nights there is no "See all" (every night is in the strip); year chips still open the full list.
- Cancelled nights stay hidden; today's ended nights count as past (existing rules, unchanged).

## Inventory coverage
Every field drawn / total: **24 / 25**. The one not drawn is the "THIS SUNDAY" flag, which does not exist on main and was deliberately not added. Changed: date badge (now weekday/day/month), "N dates" pill (now the action row label "See all N dates"), flyer 52px thumb (now 50% x 200px). Kept as is: header count, owner slots, show all/fewer, error line and retry, empty state and Browse link, series sheet, past year groups and rows, per-year and earlier-years toggles.

## Real-data shape survey (counts only, read-only, prod)
Organisers linked to at least one series (48), cancelled occurrences excluded, London today as the split. Counted through `event_series_organiser_p5` and `event_occurrence_p5`, which includes series the public RPC may hide (draft or unlisted), so it is an approximation of the public page.
- Upcoming nights: 0 = 17, 1-9 = 9, 10-39 = 2, 40+ = 20.
- Past nights: 0 = 1, 1-5 = 17, 6-33 = 17, 34+ = 13.
- Organisers with a series card (3+ upcoming dates in one series): 26.
- The lead's figure (39 with 1-9 upcoming, 1 with 13, 10 with none) differs from this survey: it is taken from the public RPC output, this one from the raw tables. Not reconciled.

## Self-running checks
- Contrast (computed): gold #E7BE6E on #0A0B0E 11.2:1; dark text on the gold chip 11.2:1; 70% cream on the page background 8.9:1. All at least 4.5.
- Tap targets: card action row `minHeight: 44`; past flyer tiles `minHeight: 44` (84px flyer); year chips and "See all" `minHeight: 44`, all explicit px.
- No clipping: title clamped to two lines with `overflow-wrap: anywhere`; venue line truncates; chip is `nowrap` and at most 11 characters.
- No sideways scroll: the flyer strip scrolls inside its own container; the page does not.
- Empty, loading and error states: unchanged and still have their action (Browse link, retry). 0 past nights shows no strip.
- Tests: `src/modules/profile/__tests__/nightsCards.matrix.test.tsx` (model and component tables).

Walk results at 390x844 are the lead's to attach.
