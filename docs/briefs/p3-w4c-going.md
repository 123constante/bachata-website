# Brief: P3 W4c, organiser-side "Who's going" mounted inside P3 (build, switch stays OFF)

Branch: `claude/p3-w4c-going` (create from main). Model: Sonnet, normal lane, no database change. Marker `[worker-done p3-w4c-going]`.

Read first: `git show origin/claude/scope-p3-w4c:docs/scoping/p3-w4c-going.md` (the scoping, including section 6 on what the per-event read does NOT give), `docs/design/going-p3-organiser.md`, `docs/handovers/going-p3-organiser.md` (exact mount code and the three agreed slots).

Build: mount the existing going parts in P3 only when BOTH `organiserP3` and the going switch (`GOING_CHECKIN_ENABLED`) are on: Home "Next up" hero, the date-sheet row "Who's going (n)", the Stats "By event" row, and the sheet. Reuse `OrganiserGoing.tsx` and `GoingTotalStat.tsx`; do not copy them. The going switch is OFF in production and stays off: nothing visible changes in prod.

Hard rules: a team Contributor is refused by the read (owner or manager only): show nothing for them, never an error. Table-driven tests: every screen x every shape (no going, 1, many, over 200 on a night, cancelled night, contributor, switch off, P3 off). Empty states say what the person can do. Zero bytes to the /app first load (`npm run check:bundle-budget` before and after; never edit perf-budgets.json or vite.config.ts). Files you own: new files under `src/modules/organiser/p3/` for going plus the mount points in the Home, Stats and date-sheet screens; touch nothing else. PR body needs Verified on real data and a Phone QA section naming 390x844; fill it with `node ~/.claude/bin/pr-body.mjs`-style content. Stopping rule: one independent review, one fix round.
