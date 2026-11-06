# Brief: Organiser editor shows a plain note when a picture fails to load
Brief-version: 2
Branch: claude/p3-broken-image-states
Lane: normal, Sonnet. Website (bachata-website), src/modules/organiser/p3 only. Must not touch the calendar density-exclusion files, supabase/, workflows or any migration.
Serves: an organiser editing their event on a phone whose cover or gallery picture address no longer loads (deleted file, bad link): today the editor shows a broken-image icon and no way to tell what is wrong.

## What main lacks
- A shared "this picture did not load" box used wherever the P3 editor shows an organiser's own picture; EventPage.tsx and the events list (parts.tsx Thumb) handle a failed load, but the Details cover and the two gallery grids do not -- grep: p3-image-broken
- extends: Details "Cover photo" must show the note instead of a broken icon, keeping the Change button so a new file can replace it -- src/modules/organiser/p3/screens/DetailsScreen.tsx
- extends: the event-wide pictures grid (DetailsScreen) and the per-date pictures sheet must show the note on a failed thumbnail and keep its Remove button -- src/modules/organiser/p3/screens/DateFieldSheets.tsx
- The words for the note, in the one labels file -- grep: detailsImageBroken

## Files
src/modules/organiser/p3/screens/DetailsScreen.tsx
src/modules/organiser/p3/screens/DateFieldSheets.tsx
src/modules/organiser/p3/screens/parts.tsx
src/modules/organiser/p3/screens/BrokenImage.tsx (new)
src/modules/organiser/p3/model/labels.ts
src/modules/organiser/p3/screens/__tests__/brokenImage.matrix.test.tsx (new)

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end. Scope of the inventory: every place an organiser's own picture (cover, event pictures, date pictures, thumbnail) is drawn in src/modules/organiser/p3, the admin equivalent, and the public event page cover.
1. New BrokenImage.tsx: a small component that renders the img and, on its error event, swaps to a box (role="img", data-testid="p3-image-broken", aria-label from labels detailsImageBroken, copy "This picture did not load. Change it or remove it.", British English, no emoji). Keyed by URL so a new address gets its own try (same rule as parts.tsx Thumb). The box is at least 44px tall and never causes sideways scroll at 390px.
2. DetailsScreen cover and its event-pictures grid use it; DateFieldSheets date-pictures grid uses it. The Change cover button and every Remove button stay present and enabled when the picture is broken; a broken picture never blocks Save and an untouched save still sends nothing.
3. Do not change EventPage.tsx cover handling or the Thumb in parts.tsx behaviour; if parts.tsx Thumb can reuse the new component with identical behaviour, do so, otherwise leave it.

## Tests
Table-driven vitest (red first, run against the unfixed code and show it failing): rows = cover, event picture, date picture; cases = loads, fails to load, fails then a new address is set, fails then Remove tapped, fails with the field disabled (no permission). Each row asserts: the note shows only on failure, the control that fixes it is present, no text points at a missing control, and an untouched save sends no command.

## Done when
- The test table is green and was red on the unfixed code; tsc clean on changed files; every CI job step in .github/workflows run in the sandbox with the per-job table in the PR body.
- INVENTORY.md written first, coverage count reported (covered / total).
- Walked at 390x844 with a cover address that returns 404, a gallery of 3 with one 404, and a date with one 404 picture; screenshots attached.
- PR body has a Verified / Not verified block, including that no prod data was written.
