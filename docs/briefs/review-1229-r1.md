# Brief: independent review r1 of Website PR #1229 (P3 series gallery editor), Opus, READ-ONLY

Branch under review: `claude/p3-series-gallery` head 5c4b981e (builder Sonnet, ticket dt_dd08420f530a). Push your review to `claude/review-1229-r1`: ONE file `docs/review/pr-1229-r1.md`. Change no other file. Read `docs/design/p3-series-gallery-inventory.md` and `docs/review/audit-create-parity.md` (branch claude/audit-create-parity) first.

## Must answer, each CLOSED / OPEN with file:line proof
1. Save path: the new `default_gallery` rides the combined `detailsPlan` upsert. Prove it equals `mediaCommand(... 'default_gallery' ...)` (events/seriesExtras.ts:14) for gallery-only edits, that an untouched save sends nothing, that a save with gallery + other fields cannot drop or reorder pictures, and that a failed upload mid-batch keeps the pictures already added.
2. Permissions: owner vs non-owner vs unfinished profile vs ended vs festival: is the row disabled with a reason in every case; can a festival gallery still be written through any path.
3. Layout at 390x844: the lead's walk showed the Pictures label sitting directly above the sticky "Nothing changed yet" save bar, with the row content hidden behind it. Is the row reachable by scrolling (bottom padding vs the sticky bar and tab bar)? Is the Pictures sheet inside the viewport (portalled, preventScroll)? Run a local Playwright/vitest check if you can; say if you could not.
4. `OnBody` was exported from RepeatSheet.tsx: any side effect or circular import? `check:bundle-budget` on main vs branch.
5. Copy: full weekday names n/a; empty states say what the person can do; raw Unicode in JSX (use entities).
6. Tests: do the 19 matrix tests fail on unfixed code for the right reason (mutate the gallery key out of detailsPlan: the tests must go red).

## Output
Verdict (blockers? safe to merge after walk: YES/NO), per-item table, B1.. vs O1.., Verified / Not verified. Under 30% context; push once. Never merge/approve.
