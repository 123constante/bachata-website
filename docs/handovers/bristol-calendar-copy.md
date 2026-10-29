# Handover: Bristol calendar copy

Done: `CalendarListView` takes an optional `citySlug` (passed from `EventCalendar`). A non-London city with zero events and no filter shows the shared `LazyEmptyCityNote` ("Coming soon" + "Tell us", from #1056, lazy so no first-load bytes). "Clear filters" now shows only when a category filter is on. London copy unchanged. Only text/button logic touched in the two owner-approved calendar files.

Tests: `src/components/calendar/__tests__/emptyCityCopy.test.tsx` (5 shapes). tsc and calendar vitest pass.

Bundle: `check:bundle-budget` fails identically on main and on this branch (vendor-supabase +14.3 KB vs baseline); all route chunk ratchets ok, /app unchanged.

Not verified: 390x844 browser walk, full CI job steps (lint chain, pre-ship), real-data shape survey (no Supabase query run; Bristol inactive), /code-review.
Next: run /code-review, the browser walk, then the PR body sections (`## Verified on real data`, `## Phone QA`).
