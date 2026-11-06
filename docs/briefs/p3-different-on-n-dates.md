# BRIEF: p3-different-on-n-dates (Website only; normal lane; Sonnet; screen work, no database change)

Brief-version: 2

Gap (FIXLIST #63, ARC-p3 W3 "Different on N dates under Where / About / Ticket"): when an organiser edits an event's Where, About, Ticket link, cover, name, photos or price for ALL dates, nothing says that some dates carry their own value that the edit will not change. Prod already returns the data: `admin_event_workspace_p5` puts `override_keys` (text[] of the keys that date owns) on every occurrence in `occurrences` (read-only pg_proc check 2026-11-06, body mentions `override_keys` at char 3515). The Website never parses it (`WorkspaceDate` in src/modules/organiser/shared/seriesModel.ts has only a boolean `has_override`).

Prod vocabulary of `override_keys` (read-only count of `event_occurrence_override_p5.overridden_keys`, 2026-11-06): cover_image_url 235, description 195, venue_id 191, city_id 186, ticket_url 78, gallery 53, cancellation_reason_label 39, title 17, music_styles 10. Cancellation reason is NOT a "different details" key. `music_styles` (10 rows) is not in OWNER_OVERRIDE_KEYS and is display-only here: no new write, no new command.

## What main lacks
- extends: WorkspaceDate carries the date's `override_keys` (string[], tolerant of null/missing/non-array/unknown strings) -- grep: override_keys
- ONE pure mapping from a workspace to "how many coming, not-cancelled dates own each field" for the fields name(title), about(description), cover(cover_image_url), where(venue_id or city_id), ticket(ticket_url), photos(gallery), price(passes), music(music_styles); no second mapping anywhere -- grep: differentDatesCount
- Details screen shows a quiet line "Different on N dates" (N=1: "Different on 1 date") under Name, About, Cover, Where, Ticket link, Music, Photos; Prices screen shows it under the price list; line hidden when N is 0 -- grep: p3-different-on
- when the workspace is capped at 100 dates (meta has_more / `ws.total` above `ws.dates.length`) the line says "Different on N of the dates shown" so it never claims a full count -- grep: of the dates shown
- extends: `ownDetailsOf` (date sheet / All dates "own details" tag) also counts music_styles so a date whose only override is music is not shown as plain -- src/modules/organiser/p3/data/dateFacts.ts
- tests: table over date shapes x fields (no overrides, one key, several keys, cancelled date with override ignored, past date ignored, unknown key ignored, null/absent `override_keys`, 0/1/N dates, over-100 series, one-off, festival) and over screens (Details, Prices); no text pointing at a missing control (the line is plain text, not a link, unless the date list can open it) -- grep: differentDatesCount.matrix

## Files
- src/modules/organiser/shared/seriesModel.ts (WorkspaceDate + parse only)
- src/modules/organiser/p3/data/dateFacts.ts
- src/modules/organiser/p3/model/differentDates.ts (new, pure)
- src/modules/organiser/p3/model/labels.ts (append to L only)
- src/modules/organiser/p3/screens/DetailsScreen.tsx
- src/modules/organiser/p3/screens/PricesScreen.tsx
- src/modules/organiser/p3/screens/__tests__/wsFixtures.ts (add `override_keys` to the fixture dates; append only)
- src/modules/organiser/p3/model/__tests__/differentDates.matrix.test.ts (new)
- src/modules/organiser/p3/screens/__tests__/differentDates.screens.test.tsx (new)
- docs/handover/p3-different-on-n-dates.md
Do NOT touch: calendar files in CLAUDE.md density exclusions, EventPage.tsx, DateSheet.tsx, AllDatesScreen.tsx, P3Routes.tsx, paths.ts, seriesCommands.ts, any file under supabase/.

## What to build
1. Prove the source first: say in the handover which RPC and key the line depends on (above). Do not call any write RPC.
2. Red first: write the matrix tests, run on main, keep the red output in the handover.
3. Implement. Compact density (.claude/rules/design-density.md): text-sm/px sizes, `p-3`, no new card; tap targets unchanged. Copy: "Different on N dates" using the shared mapping only. HTML entities in JSX, no raw Unicode punctuation.
4. Run: `npm run lint`, `vitest run src/modules/organiser`, `npm run check:integrity`, `npm run check:mojibake`, `npm run check:bundle-budget` (0 bytes to the app first load; the P3 chunk only).
5. PR body: "Verified on real data" lines (shapes above; counts from the prod vocabulary) and a Phone QA section naming 390x844 (Walked: matrix only; Not verified: real phone). Design record docs/design/<pr>.md: one line (quiet note, no new control).
6. Push once; last commit subject ends `[worker-done <ticket>]`. One build round, one independent review, one fix round.

Branch: claude/p3-different-on-n-dates
Model / lane: Sonnet, normal lane (screen work, no database change).
