# Session handover: P3 W3a fix round 1 on PR #1082 (2026-10-27, ticket dt_dd01069e94fa)

Branch `claude/p3-w3a-details` (PR #1082). Brief `brief/p3-w3a-fix1` `docs/briefs/p3-w3a-fix1.md` (sha 90bd91a).
Review `claude/review-1082-r1` `docs/reviews/1082-r1.md`. Per-finding outcome table: `docs/design/1082.md`
"Review round 1". Main had not moved (dd8112f), so no rebase was needed.

## Done
- r1 #1 opened version (Details, Prices AND SessionSheet, which had the same pattern); r1 #2 normalised Prices
  compare + `trayLines` belt and braces; r1 #3 city always sent (null included), lookup on pick, failed lookup
  holds Save with Try again; r1 #4 landed steps are the screen's own; r1 #5 matrix rows only (0 prod festivals
  store `free`); r1 #7 cover button + Undo clears the photo problem; r1 #8 Details/Prices lazy inside P3Routes.
- r1 #6 NOT fixed: the old caps are a module-private `MAX_LEN` in `events/Details.tsx`, not an exported rule.
- 16 new tests red on 4da101f, green now (`w3a.r1.matrix.test.ts`, `editScreens.send` "review round 1",
  `w2dNits` r1 #1); plus the r1 #7 test. One W2d test that pinned the stale-version defect was changed (design record).
- Found while fixing: `own` ref read during render (eslint error on 4da101f), now state.
- Prod reads (read-only): `_cmd_series_upsert_p5` requires `name` and takes `default_city_id` null; `free` count.

## Open / blocked
- **bundle-budget stays RED and is not this PR's to fix:** the pin is 374 KB = 382,976 B. Main dd8112f builds to
  374.1 KB (~383,105 B), already ~129 B over before W3a; this head is 383,156 B (W3a's share after r1 #8 is
  51 B gzip: one extra route-table entry `useAreaLeaveBlocker`, which Rollup now splits out of AreaRoutes because
  the save model's leave guard shares it, plus 11 B in the dancer-app chunk). Owner call: cut ~180 B from the
  /app first load on main, or a deliberate pin decision. The pin was NOT raised here.
- **contract-check RED, also on main:** `check-og-render-health.mjs` (prod og_render bakes refused HTTP 403 by a
  bot challenge); same failure on main runs 40538380424 / 40537442269 and PRs #1086 / #1080. Infra, not this PR.
- No `/code-review` round on the fixes (fixes to findings are unreviewed code).
