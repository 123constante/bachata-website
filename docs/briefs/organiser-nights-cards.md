# Brief: organiser page nights cards (Next nights D4 + Past nights highlights)
Brief-version: 2
Branch: claude/organiser-nights-cards
Lane: normal, Sonnet. Screen change, NO database change, no migrations. Repo 123constante/bachata-website. One PR. Design Gate applies (design record + inventory).

## Goal
On the public organiser page (`/organisers/:id`, src/pages/OrganiserProfile.tsx) make "Next nights" cards bigger and clearer (design D4) and replace the cramped "Past nights" list with a highlights strip (option 2). Owner decisions are final (2026-11-06): do not offer alternatives.

## Read first
- docs/briefs/organiser-nights-cards.INVENTORY.md (on this brief branch): every element, state and file:line of both sections today. Fill its "In mockup?" column and end the design record with a coverage count (every field drawn / total).
- Mockup, direction D4: https://claude.ai/artifact/Y7GLayKSLzjFXT2cTTZkTP (read-only).
- Page rules still apply: calendar density-exempt files untouched; British English; full weekday names; explicit px for tap targets >= 44px (the site root font is about 13.5px on phones); HTML entities not raw unicode punctuation in JSX; no hand-rolled breadcrumbs.

## What main lacks
- a Next nights card with the countdown chip on the flyer, flyer left at 50% width and 200px tall -- grep: nights-card-chip
- the card's bottom action row ("View event" for one night, "See all N dates" for a series) as the 44px tap row -- grep: nights-card-action
- a Past nights highlights strip: nights hosted, nights this year, the six latest flyers (newest first), a "See all N nights" button -- grep: past-highlights-strip
- year shortcut chips (one per year with its count) that open that year's list below -- grep: past-year-shortcuts
- the design record with the coverage count -- docs/design/organiser-nights-cards.md

## Files
- src/pages/OrganiserProfile.tsx (the Next nights and Past nights sections only)
- src/modules/profile/NightsCard.tsx (new)
- src/modules/profile/PastHighlights.tsx (new)
- src/modules/profile/nightsCardModel.ts (new, pure: chip text, venue line, action label, past counts)
- src/modules/profile/__tests__/nightsCards.matrix.test.tsx (new)
- docs/design/organiser-nights-cards.md (new)

## What to build
1. NEXT NIGHTS card (D4). Whole card is one tap target (single night = link to the event page with occurrenceId as today; series of 3+ dates = opens the existing SeriesDatesSheet). Layout: flyer left, 50% width, 200px tall, object-cover; right column top to bottom: weekday (gold, 12px, uppercase, full name), big day number (serif ~38px) with the month beside it, title (serif ~17px, two lines max), venue line, then the bottom action row (min height 44px, gold, chevron). Keep the existing rules for: which nights show (cancelled hidden), series grouping (3+ dates), first 3 items visible with "Show all N dates" / "Show fewer", error line + retry, "No dates announced yet" empty state with the "Browse upcoming nights" link, owner slots, impressions.
2. COUNTDOWN CHIP on the flyer, bottom-left. Wording comes from the page's own existing countdown rules (Tonight / Tomorrow / in N days / next week / in N weeks); do NOT invent a "this week" or "THIS SUNDAY" flag. The chip text must be 11 characters or fewer: for 26 or more weeks use "in N months" (N up to 9), beyond that show a short month and year ("Feb 2027"). Solid gold when the night is within 7 days, dark with a gold border otherwise.
3. VENUE LINE: venue name else city else no line at all (never "undefined", never an empty gap). Time only for a single night and only when it is a real time (not date-only / 00:00), exactly as today. A series shows no time.
4. NO-FLYER fallback: keep the gradient fallback, with the organiser's or event's initials centred, so the card keeps its 200px height and the chip still has somewhere to sit.
5. PAST NIGHTS strip. Header keeps "Past nights" (and "Recently hosted" when there are only past nights). Strip: "N nights hosted" (cancelled excluded, today's ended nights count as past, exactly as today), "N this year" (the current London calendar year), then a horizontal row of up to six latest flyers (newest first, each 44px+ tap target linking to the event page with occurrenceId; no flyer = gradient with initials), then a "See all N nights" button that reveals the full list. The full list keeps the current year groups and rows (so nothing is lost); year shortcut chips (one per year, "2026 (12)") open and scroll to that year's group. With 0 past nights show no strip; with 1 to 5 nights show only the flyers that exist and no empty slots; do not show "See all" when every night is already in the strip.
6. Pure model + tests: put the chip text, venue line, action label and the past counts in nightsCardModel.ts and test them table-driven: single/series x flyer/no flyer x venue/city/neither x time/no time x countdown ranges (today, tomorrow, 2 days, 6 days, 8 days, 15 days, 97 days, 400 days) x very long title; past 0, 1, 5, 6, 8, 33 nights, year boundary (31 Dec / 1 Jan London), cancelled excluded. Red first for any bug you find.
7. Real data: survey counts only (Supabase read-only, project stsdtacfauprzrdebmzg): how many organisers have 0 / 1-9 / 10-39 / 40+ upcoming nights, how many have 0 / 1-5 / 6-33 / 34+ past nights, how many have series (3+ dates) cards. Put the counts in the PR body and the design record. Known from the lead: 39 organisers have 1-9 upcoming, 1 has 13, 10 have none.
8. Design record docs/design/organiser-nights-cards.md: the chosen design (D4 + option 2), the inventory coverage count, and the self-running checks you ran (contrast >= 4.5, taps >= 44px, no clipping, no sideways scroll, every empty/loading/error state has an action). Do not write walk results: the lead walks at 390x844 on the real organiser pages and attaches screenshots.

## Do NOT touch
EventCalendar.tsx, calendar/*, useCalendarEvents, src/components/ui/dialog.tsx, supabase/**, migrations, workflows, scripts/**, .env*, any other page. Do not change EventRow.tsx or SeriesDatesSheet.tsx behaviour used elsewhere (check importers with git grep first; add new components rather than editing shared ones).

## Done when
One push; PR body has "## Verified on real data" (Shapes surveyed / Checks run / NOT verified) and "## Phone QA" (Sizes checked 390x844 / Walked / Not verified: write "walk by lead"); the matrix test is green; every CI job step that applies has been run and the per-job table is in the PR body; last commit subject ends with the [worker-done ...] marker.
