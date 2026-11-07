# Brief: an organiser with no bio gets an About pencil (the empty About line has no control)
Brief-version: 2
Branch: claude/organiser-about-empty-pencil
Lane: normal, Opus. Repo 123constante/bachata-website. One PR. Screen change, no migration, no hard-tier path.

## Goal
On the public organiser page, an owner who has not written a bio sees the line "Not added yet. Optional: tell dancers who you are and what your nights are like." with no way to add one: the empty-About slot renders text only. Make that line carry the real About pencil (the same one that exists once a bio is set) so the owner can act on what the copy says.

## What main lacks
- an About pencil beside the empty About line, so a no-bio owner can open the bio editor -- grep: aboutEmptyPencil

## Files
- src/modules/organiser/edit-in-place/parts.tsx
- src/modules/organiser/edit-in-place/EditInPlaceLayer.tsx
- src/modules/organiser/edit-in-place/__tests__/aboutEmpty.matrix.test.tsx (new)
- a short design record docs/design/<pr>.md (new)

## Evidence on origin/main (2026-11-07; re-grep before editing, line numbers drift)
- src/pages/OrganiserProfile.tsx:1256 and :1288 render `eip?.slot(ep.bio ? 'about' : 'about-empty')`.
- EditInPlaceLayer.tsx:392 `case 'about': return <AboutSlot ... />` (the pencil); :393 `case 'about-empty': return <AboutEmpty />`.
- parts.tsx:185-198: `AboutSlot` renders the `PencilButton field="bio"`; `AboutEmpty` is a bare `<p data-testid="eip-about-empty">` with the sentence above and NO control.
- The blank-page empty state (PR #1471, open) already holds an About pencil via slot('about') beside "Create your first event"; do not touch src/pages/OrganiserProfile.tsx, so this brief does not overlap it.

## What to build
0. Write INVENTORY.md first (in the design record or PR body, not the repo root): every place the page shows an owner a "not added yet / optional" line for a field (bio, year, category, links, photo, city) with file:line and whether a control sits beside it. Build only after it exists; report the coverage count (lines with a control / lines total). Fix ONLY the About line here; list the others under "found, not fixed".
1. In the layer's `about-empty` case render the existing sentence plus the real About pencil (reuse `AboutSlot` or `PencilButton field="bio"`; do not make a second pencil). The pencil is at least 44px with explicit px (the site html font-size is about 13.5px on phones), has the same accessible name as the filled-bio pencil, and opens the same FieldSheet bio editor.
2. Pick the one design yourself (pencil inline at the end of the sentence, or on its own line under it) and record why plus one rejected alternative in two lines each in docs/design/<pr>.md. No clipping at 390px wide: the sentence wraps to 2-3 lines and the pencil must not cover a word (a previous walk found a button covering a word).
3. Table-driven test, red first against the unfixed code (say so): {no bio, bio set, bio drafted but unsaved} x {owner with edit layer, visitor}: owner with no bio sees the sentence AND an enabled bio pencil that opens the bio sheet; owner with a bio sees the existing pencil only (no empty line); a visitor never sees the empty line or any pencil.
4. Checks: tsc 0 errors in touched files; vitest src/modules/organiser/edit-in-place src/modules/profile; npm run check:mojibake. Use &mdash;/&rsquo; entities and \u escapes, no raw Unicode punctuation. Files over 2 KB go through scripts/safe-edit.py. Survey (read-only, counts only, Supabase MCP prod stsdtacfauprzrdebmzg): how many organiser_profiles have an empty or null bio and have links, a team or events (the owners this fixes), for "Shapes surveyed".
5. PR body: "## Verified on real data" and "## Phone QA" with the exact labels. Push once with the [worker-done ...] marker.

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, src/pages/OrganiserProfile.tsx, supabase/**, migrations, workflows, scripts/**, .env*, any file not listed under Files.

## Done when
One push; branch merges cleanly with main; every CI job step that applies has been run and the per-job table is in the PR body; the PR body has "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and "## Phone QA" (- Sizes checked: / - Walked: / - Not verified:); last commit subject ends with the [worker-done ...] marker.
