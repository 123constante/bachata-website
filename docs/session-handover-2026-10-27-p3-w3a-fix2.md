# Session handover: P3 W3a fix round 2 on PR #1082 (2026-10-27, ticket dt_254052782a92)

Branch `claude/p3-w3a-details` (PR #1082). Brief `brief/p3-w3a-fix2` `docs/briefs/p3-w3a-fix2.md` (blob f9f6392).
Review `claude/review-1082-r2` `docs/reviews/1082-r2.md`. Per-finding table: `docs/design/1082.md` "Review round 2".
Main had not moved (dd8112f), so no rebase was needed.

## Done
- r2 #1 `useSaveRun` drops the held attempt on `version_conflict` and on Start again (`forget()`); r2 #3
  `changedElsewhere` is `now > openedAt && !own.has(now)`; r2 #7 city lookup times out after 10 s into the
  failed state with Try again; r2 #6 Known-limits line; r2 #5 residual: `VERSION_CONFLICT` copy asserted on
  Details and Prices.
- 4 new tests RED on 47e6753 (output kept in the session, reasons: expected 7 to be 8; banner shown; still
  "Finding the place's city"), green now. All 20 p3 test files green (1262 tests).

## Blocked: bundle-budget (r2 #2) -- needs the owner
Measured with the perf-budget.yml env, `npm run build` + `npm run check:bundle-budget`, gzip bytes of the
dancer-app first-load JS (48 files, pin 374 KB = 382,976 B):
- main dd8112f: **383,129 B (374.1 KB), 153 B over on its own.** Main's own CI bundle-budget is RED
  (Perf Budget run 40538380399, `[OVER BUDGET] dancer-app ... 374.1 KB`); the previous main 4c683ce was green,
  so #1056 (Bristol polish) took it over. The brief's "main was 373.7 KB" predates #1056.
- this head: 383,156 B (374.2 KB), +27 B: `AnimatedRoutes` +22 B (its preload list gains
  `useAreaLeaveBlocker-*.js` and `.then(n=>n.a)` on the P3Routes import), the rest is +-5 B hash churn.
- Even removing W3a's 27 B leaves the check red. Owner call: cut ~180 B from the /app first load on main
  (a separate PR), or a deliberate pin decision. The pin was NOT raised, nothing in /app was cut here.

## Other CI
- contract-check RED, also on main (`check-og-render-health.mjs`, prod og_render 403 bot challenge).
- phone-qa RED on 50760e9 in `invite-w2-golive.phone.spec.ts` only (4 failed + 4 flaky, organiser phone /
  Instagram fields, not in this diff); the same spec passes 15/15 locally on this head. The final push re-runs it.

## Not done
- No re-walk: no state's pixels changed (the banner only shows less often; the timeout lands on the existing
  17-details-city-fail state). No `/code-review` round on the r2 fixes.
