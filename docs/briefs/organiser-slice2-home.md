# Brief: organiser slice 2, Home dashboard (before / on the night / day after)

Branch: `claude/organiser-slice2-home`, cut from `origin/main` (slice 1, PR #1748, is merged). One PR. Flags: `organiserShellV2` + `organiserP3` + `organiserDash`; all off on live, so live must not change. Flag off = byte-identical behaviour.

Design source: canvas https://claude.ai/artifact/WyBvUeP1paFcUYR8frNyiR, page "Round 4: whole app", screens 1-4 (Home before / on the night / day after, Compare nights). Look: white + orange #C2410C. Read `~/.claude/plans/DESIGN-REGISTRY.md` rows "Organiser dashboard" and "Organiser area base". If the canvas cannot be opened, build from this brief and say so in the PR.

## Owner decisions (binding)
1. Per-night card shows Going + link taps by type (tickets, share, WhatsApp, directions). Positive numbers only.
2. A zero row is hidden. In its place show ONE short suggested-action tip (e.g. "Share your link to get taps").
3. "Compare nights" is a row at the bottom of Home. Tapping it opens the ranked list (round-4 screen 4).
4. Day-after big number = Who came (checked-in count). Tickets sold and the raffle result sit underneath it.
5. NO money anywhere on Home. No charts, no page-view tiles, no saves.
6. Pushed screens (Compare nights) hide the bottom tabs, as slice 1 does.
7. Own draft night cards: there is no per-night taps read (GAP-4). Use what the existing reads give (series-level `organiser_analytics_v2` link_taps in `p3/data/analyticsV2.ts`; per-night Going from `P3NightGoing` / `P3Going.tsx`). Show a number only when it is known and above zero; never invent per-night taps.

## Build
- Extend the existing `p3/dash/DashHome.tsx`, `dashModel.ts`, `DashView.tsx` (flag `organiserDash` already routes there from `HomeScreen.tsx`). Reuse `tickets/a/clockState.ts` (before / door / after) for which state Home is in; do not write a second clock.
- Before: next night card, Going, link taps, share button, tip when zero.
- On the night: Going / Who is in count as the headline; link to Door where slice 1 put it.
- Day after: Who came big number, tickets sold + raffle result underneath. If no check-in count exists for a night, hide the big number and show the tickets-sold line only; say in the PR which it was and where the count comes from.
- Compare nights: ranked list of the page's past nights by Who came (fallback Going), read only.
- Keep the seat rules already in `dashModel` (contributor sees no money; Home has none anyway).
- Do NOT touch `p3/tickets/*` or `p3/door/*` (ticketing peers own them). Do not touch the calendar density-excluded files.

## Rules
- Unicode punctuation as `\u` escapes or HTML entities (mojibake check). Tap targets explicit px (html font-size trap). Compact density.
- Every state in a table-driven vitest: before / night / after x zero / some / many x contributor / owner x cancelled night x draft night (draft night shows own card, no taps) x series with 13 dates.
- Real-data shape survey (read-only SELECT counts, prod `stsdtacfauprzrdebmzg`): note in PR body. 390x844 walk via laptop-walk if the cloud has no auth; say "Not verified" honestly.
- Run every applicable CI step locally; `npm run pre-ship`. PR body needs the "Verified on real data" block. Do not merge.
- Push often. End the final commit subject with your `[worker-done <ticket>]` marker.
