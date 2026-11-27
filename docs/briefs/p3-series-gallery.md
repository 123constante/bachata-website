# Brief: P3 series multi-picture gallery editor (Website, normal lane), Sonnet

Branch `claude/p3-series-gallery` off main (push ONLY here, ONE push at the end, plus at most one early `[skip preview]` push). Under 50% context, stop starting new work at 45%. Final commit subject ends `[worker-done <ticket>]`. No `supabase/**`, no migration, no prod write. Flags for walking: VITE_ENABLE_ORGANISER_P3=true.

## Why
`docs/review/audit-create-parity.md` (branch `claude/audit-create-parity`, git fetch it) row 13: the old organiser area edits the SERIES gallery (`src/modules/organiser/events/EditorSheet.tsx:105` case 'gallery', saved by `events/seriesExtras.ts:14` via `mediaCommand(... 'default_gallery' ...)`, wired in `events/Details.tsx:134`). P3 has no writer for it. 5 live owner-editable series have more than one picture. It is the ONLY blocker to retiring the old area.

## Do
1. INVENTORY.md first (docs/design/p3-series-gallery-inventory.md): every gallery state/option in the old EditorSheet case 'gallery', the P3 DetailsScreen, `p3/screens/DateSheet.tsx:277-279` (per-date photos, reuse its pattern), the public page gallery render; file:line; coverage count at the end.
2. Prove the data source first: read the live `mediaCommand` / series update RPC body read-only and state which column `default_gallery` writes, max count, who may write.
3. Add a "Pictures" row on the P3 Details screen (`p3/screens/DetailsScreen.tsx`, `p3/data/details.ts`) that opens a sheet reusing the existing gallery picker/uploader and the SAME `mediaCommand(... 'default_gallery' ...)` writer. No new write path. Labels in `p3/model/labels.ts`. Empty state says what the person can do; saving untouched sends nothing; failures use the existing P3 error pattern.
4. Table-driven matrix test over gallery shapes: 0, 1, 2, 5 and over-cap pictures x owner/non-owner x course/recurring/festival (festival read-only per CONTRACT.md:211, 468). Red first: show the new tests fail before the row exists.
5. Zero bytes to the /app first load: `npm run check:bundle-budget` on main and branch; never edit perf-budgets.json or vite.config.ts. Overlay: sheet portalled to body, `focus({ preventScroll: true })`.
6. Use explicit px for tap targets (html font-size is ~13.5px on phones). HTML entities not raw Unicode in JSX.
7. PR body via the template: Verified / Not verified, `## Phone QA` section (Sizes checked / Walked / Not verified), per-job CI table. Say what you could not walk.
