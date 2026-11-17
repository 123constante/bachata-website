# Brief: organiser slice 3, read-only sheets (Who is in / Who came)

Branch: `claude/organiser-slice3-sheets`, cut from `origin/main` (slices 1 and 2, #1748 and #1757, are merged). One PR. Flags: `organiserShellV2` + `organiserP3` + `organiserDash` (+ `organiserSelfServe` for the route); all off on live, so live must not change. Flag off = byte-identical behaviour.

Design source: canvas https://claude.ai/artifact/WyBvUeP1paFcUYR8frNyiR, page "Round 4: whole app" (the Who is in and Who came screens). Look: white + orange #C2410C, same as slice 2 Home. Read `~/.claude/plans/DESIGN-REGISTRY.md` rows "Organiser dashboard" and "Organiser area base". If the canvas cannot be opened, build from this brief and say so in the PR.

## What to build
Two READ-ONLY sheets, plain build, no new design round:
1. **Who is in** (door night): the names of guests already checked in for one night, with the count as the headline and "expected / still to arrive" underneath. Opened from the on-the-night Home headline and from the night's page.
2. **Who came / did not come** (day after): two lists for one past night, Came and Did not come, count as headline. Opened from the day-after Home big number and from Compare nights rows.
No buttons that change anything: no check-in, no refund, no messaging, no export. A person with no name shows "Guest".

## Data
Use ticketing's v3 door functions only, as `p3/dash/pastNights.ts` already does (`ticket_door_list_v3(series, occurrence)`: in_count = checked in, total_count). Reuse that read; add one typed reader beside it if the list rows are needed. Do NOT call legacy door RPCs. If the v3 list returns no names (counts only), say so in the PR and show the count sheet with "Names are not available yet", do not invent names.
Seat rules: contributor sees names but no money; there is no money on these sheets anyway.

## Rules
- Do NOT touch `p3/tickets/*` or `p3/door/*` (ticketing peers own them); read through `p3/dash` and a new `p3/sheets/` folder. Do not touch the calendar density-excluded files.
- Pushed sheet: bottom tabs hidden, back returns to where it was opened from (as slice 1).
- Unicode punctuation as `\u` escapes or HTML entities. Tap targets explicit px (html font-size trap). Compact density. Empty states say what the person can do ("Nobody has checked in yet. Open Door to scan tickets" only if the Door link exists on screen, else just "Nobody has checked in yet.").
- Table-driven vitest: night / after x zero / some / many (over 100 rows) x null name x contributor / owner x cancelled night x draft night (no sheet link) x series with 13 dates. Run new tests against the unfixed code first.
- Real-data shape survey (read-only SELECT counts, prod `stsdtacfauprzrdebmzg`) in the PR body; 390x844 walk via laptop-walk if the cloud has no auth (walk needs VITE_ENABLE_ORGANISER_P3, _DASH, _SELF_SERVE); say "Not verified" honestly.
- Run every applicable CI step locally; `npm run pre-ship`. PR body needs the "Verified on real data" block. Do not merge.
- Push often. End the final commit subject with your `[worker-done <ticket>]` marker.
