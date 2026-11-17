# Brief: slice 2 continuation, show the Home dashboard in the V2 shell

Branch: `claude/organiser-slice2-home` (PR #1757, do not open a new PR). Read `docs/briefs/organiser-slice2-home-handover.md` first.

Owner click 2026-11-17: with `organiserShellV2` on there is no Home tab, so the new Home never shows. Put the Home dashboard at the TOP of the Events tab (`V2EventsTab` in `p3/v2/V2Tabs.tsx`). Still four tabs. No new tab.

Do:
1. In `V2EventsTab`, render the slice 2 dash Home (the `DashHome` component, same props as `HomeScreen.tsx` gives it: rows, today, page, seriesIds from the page scope / event choice) above `EventsScreen`. Keep `HomeNotices`, the Team card and AccountEntry as they are. Flag off (V2 off) = unchanged.
2. Compare nights stays a pushed screen at `/account/p3/compare`; make sure it opens and returns correctly from V2 (`isPushed`, no bottom tabs, back goes to the Events tab). `homePathOf` / "Home" links under V2 still point at Events.
3. Avoid duplicates: if the dash already shows the next night, do not also show a second next-night card on the Events tab above the list.
4. Tests: extend `slice2Home.matrix.test.tsx` or V2 tab tests: V2 Events tab shows the dash block for before / night / after, contributor sees no money, no-page and loading states still redirect/render as today.
5. Do not touch `p3/tickets/*` or `p3/door/*`. Mojibake: `\u` escapes.
6. Update PR body (real-data and Phone QA labels), run pre-ship steps you can, push. End the final commit subject with your `[worker-done <ticket>]` marker. Do not merge.
