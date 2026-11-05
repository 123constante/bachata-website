# Design record: organiser page Next nights / Recently hosted (public)

Author: website-18. Status: DRAFT for the lead (design is the lead's call), one independent critique pending. Mock-up: six states A-F at 390 wide, `p2-nights-mockup.html` (website-18 scratchpad; publish private after critique).

## Owner decisions this design obeys
E7 cancelled nights hidden everywhere; E4 all the organiser's nights whatever the city, city named on each night; E5 the next 20 upcoming nights whenever they are (admin RPC `get_organiser_nights_v2`, brief on admin branch brief/organiser-nights-feed); repeating events stay ONE row with an "N dates" tag (owner click 2026-11-05); when more than 20: a quiet line "Showing the next 20 nights" (owner click). ACCEPTANCE: when nothing upcoming, "Recently hosted" leads with one quiet line "No dates announced yet"; no city hard-coded (E6).

## INVENTORY (admin + current Website + public page)
| # | Surface | Where (P1 branch a2992d85) | Today | In this design? |
|---|---|---|---|---|
| 1 | Next nights section | `src/pages/OrganiserProfile.tsx:1322-1357` | heading "Next nights", count "N dates", rows, "Show all N dates" after `UPCOMING_VISIBLE = 3` (:397) | Yes: keep rows; change count/cap wording; see below |
| 2 | Row grouping | `OrganiserProfile.tsx:934-957` (`groupByEventId`, series vs single) | a repeating event = one row + "N dates" chip opening a dates sheet | Kept (owner click) |
| 3 | Row card | `src/components/events/EventRow.tsx:56-125` | 52px poster + date badge, name, grey meta line, chip, chevron | Unchanged look |
| 4 | Meta line | `OrganiserProfile.tsx:435-440` (`buildEventRowProps`) | countdown, venue OR city, time | Yes: venue AND city together on every night |
| 5 | Dates sheet for a series | `setOpenSeriesEventId` handler at `OrganiserProfile.tsx:1347-1352` | list of the series' dates | Yes: city shown on each date (state C) |
| 6 | Cancelled handling | `OrganiserProfile.tsx:770, 783` (`if (occ.is_cancelled) continue`) | hidden client-side | Becomes server-side; client filter stays as a guard |
| 7 | Empty / past-only | `src/modules/profile/organiserEmptyState.ts:36-37`, `NO_DATES_ANNOUNCED` | "No dates announced yet" + Recently hosted / Browse link | Unchanged (states D, E) |
| 8 | Feed error line | `OrganiserProfile.tsx:383` (`FeedErrorLine`) | "Couldn't load..." + retry | Unchanged (state F) |
| 9 | Past nights | `OrganiserProfile.tsx:1375-1380` | accordion by year, "Past nights" or "Recently hosted" | Unchanged, but all cities now |
| 10 | Admin | admin organiser event list | separate list, not public | Not changed |
Coverage: 10 rows, 10 handled, none silently omitted.

## Chosen design (ONE)
Keep today's row cards exactly; change three things. (1) City on every night: the grey line reads `countdown · venue, city · time`, never a bare venue. (2) The cap: when the feed returned the maximum of 20 nights, drop the "N dates" count in the heading (it would claim 20 is the whole story) and end the list with one quiet centred line "Showing the next 20 nights"; when fewer than 20, keep "N dates" in the heading and no line. (3) "Show all N dates" after three rows stays for singles; the series sheet lists each date with its city.
Weekly organisers: one row per repeating event with an "N dates" tag. When the 20-night cap is hit the tag reads "next 20 dates" (lead decision 2026-11-05) and the line under the list says the rest; the cap stays on nights, no RPC grouping. If several repeating events share the 20, each tag shows its own count.

## Alternatives (two lines each)
- A. One row per night, diary style: easiest to read as "what is on", but a weekly class fills all 20 rows and buries everything else. Rejected by owner click.
- B. Group by month with sticky month headings: nice for 20 rows, but adds structure the page does not have anywhere else and costs vertical space on a compact page. Rejected.

## Why
It changes nothing visitors already understand, shows exactly what the owner decided (all cities, next 20, no cancelled), and never lets "20" read as everything.

## Flags for the lead (both answered: keep cap on nights; tag reads "next 20 dates" when capped)
- F-1: grouping happens on the client AFTER the 20-night limit, so a weekly organiser's 20 nights can collapse into one or two rows (state B). The cap is on nights, not events; if the lead wants "next 20 events" instead, the RPC must group, which is a different brief. Owner said "next 20 upcoming nights".
- F-2: the series row's tag says "20 dates" even though the organiser has 200+; the line under the list is what tells the truth. If this reads wrong, say "next 20 dates" on the tag when capped (a one-word change).

## Self-running checks on the real build
Contrast >= 4.5 (the shipped grey meta line is rgba(246,241,234,.55): about 5.4:1 on the card tint, computed by the critic; keep >= 4.5); taps >= 44px (rows, Try again, Browse); no sideways scroll or clipping at 390x844 with a long venue plus city (the meta line truncates with an ellipsis; check the city survives, or wraps to two lines); states A-F reachable on prod-shaped organisers (weekly 100+, past-only, no nights, mixed cities).

## Critique round 1 (Sonnet impeccable-finish-reviewer) and fixes
1 HIGH the city clipped at 390 (meta about 230px = ~38 characters; 'In 10 days · Old Fire Station, Bristol · 7pm' is 46): the meta line WRAPS to two lines (line-clamp-2 instead of truncate) in the build; test with a 35-character venue. 2 HIGH state B sums to 32 nights: now one repeating event. 3 When capped and more than 3 rows, the button reads 'Show more nights' (not 'Show all N dates') and the cap line sits after the list; use the word 'nights' for counts the visitor reads. 4 Mock aligned to the real component: series rows show countdown + location only (no time), 12-hour times ('8:30pm'), chronological order, chevron on past rows; a series that spans cities shows the first city plus '+1 city' (RULE TO CONFIRM with the lead). 'N hosted' count on past headings and the block after `emptyKind === 'past-only'` were not read by the critic: the build keeps them as on main. 5 Mock sizes are idealised; the build is checked at the real 13.5px root. 6 Contrast recomputed on the shipped .55 value. 8 The dates sheet city column wraps and right-aligns; whether date rows open the night stays as on main.
