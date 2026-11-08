# Brief: Details hints tell the truth for festivals and videos (P3)
Brief-version: 2
Branch: claude/details-honest-hints
Lane: normal, Sonnet. Website only, no database change. Must not touch the calendar density-exclusion files, src/modules/event-page/**, or any save command.
Serves: an organiser editing Name and details on a festival or adding video links.

## What main lacks
- extends: the Details kind card says "Worked out from your sessions. Change a session to change it." on EVERY kind, but a festival's sessions are read-only ("Ask us to change the programme", `festivalAsk`), so the hint points at a control that does not exist -- src/modules/organiser/p3/screens/DetailsScreen.tsx
- A festival-specific kind hint that sends the person to the team, not to a session -- grep: detailsKindHintFestival
- extends: the Videos hint says only "One link per line, starting with https://", but the public event page plays only the FIRST link YouTube, Vimeo or a direct upload can play (`pickPlayableVideo`); other links are saved and not shown -- src/modules/organiser/p3/model/labels.ts
- A Videos note saying which link dancers see, so extra links do not look broken -- grep: p3-d-videos-note

## Files
- src/modules/organiser/p3/model/labels.ts
- src/modules/organiser/p3/screens/DetailsScreen.tsx
- src/modules/organiser/p3/screens/__tests__/detailsHints.matrix.test.tsx (new)
- docs/arcs/organiser.md (update the "Walk-report dead ends A to D" row: Status, Blocked by, PR link, in the same PR)

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. Add label `detailsKindHintFestival` ("Festival sessions are set with the Bachata Calendar team. Ask us to change the programme.") and render it in place of `L.detailsKindHint` when `kindOf(...)` is `festival` (`data-testid="p3-d-kind-hint"`). Every other kind keeps today's words byte for byte.
2. Under the Videos field add a one-line note (`data-testid="p3-d-videos-note"`, shown only when 2 or more links are typed): "Dancers see the first link that can play (YouTube, Vimeo or an uploaded video). The others are kept." Counted from the same parsing the field already uses; no note for 0 or 1 link.
3. No new colours; existing p3 note style; no sideways scroll at 390x844; copy uses &rsquo; style entities, never raw Unicode punctuation.

## Tests (red first)
Table: kind {weekly, one-off, course, festival, draft one-off} x hint text and test id; videos {0, 1, 2, 5 links, 2 non-playable} x note shown or hidden. Run against the unfixed code first and show the festival and 2-link rows red. Untouched Save still sends nothing.

## Done when
Matrix green, existing Details and editShapes suites green, PR checks green, INVENTORY.md coverage count stated. PR body carries Verified / Not verified (survey: 8 live festivals on prod via read-only counts; no 390x844 walk unless done).
