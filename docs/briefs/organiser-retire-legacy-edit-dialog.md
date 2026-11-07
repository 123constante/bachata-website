# Brief: Organiser page: retire the legacy Edit profile dialog, one editor (edit-in-place) remains
Brief-version: 2
Branch: claude/organiser-retire-legacy-edit-dialog
Lane: normal, Opus. Repo 123constante/bachata-website. One PR. Screen change, no migration, no hard-tier path.

## Goal
The public organiser page has two editors. Edit-in-place (pencils, FieldSheet with a category picker, validated photo upload) is the real one; a second legacy "Edit profile" dialog (raw Avatar URL text box, free-text Category) is still reachable from exactly one place: the "Complete your profile" button in the owner-blank empty state. Make that button hand the owner to edit-in-place, then delete the legacy dialog so one editor remains.

## What main lacks
- the owner-blank state 'Complete your profile' opening edit-in-place (photo/about slots) instead of the legacy dialog -- grep: retireLegacyEditDialog

## Files
- src/pages/OrganiserProfile.tsx
- src/modules/organiser/edit-in-place/__tests__/visibility.matrix.test.tsx (only the owner-blank case, line ~242)

## What to build
0. Write INVENTORY.md first (put it in the PR body or docs/design/<pr>.md, not the repo root): every field in the legacy dialog (name, category, founded year, avatar URL, city, bio, instagram, facebook, website) and where edit-in-place already edits it (EditInPlaceLayer.tsx, FieldSheet.tsx), each with file:line. Build only after it exists, and report the coverage count (legacy fields covered by edit-in-place / total) at the end. If any legacy field has NO edit-in-place equivalent, STOP and report it in the handover instead of deleting the dialog.
1. Verified on origin/main (2026-11-07): src/pages/OrganiserProfile.tsx has `openEditModal` (~line 897), `isEditOpen`/`editForm`/`openedFormRef` state (~630-645), the save handler calling `saveOrganiserProfile` (~919-953), the `<Dialog open={isEditOpen}>` (~1538-1570+), and the only caller: the "Complete your profile" button in the `emptyKind === 'owner-blank'` section (~1358). Re-grep before editing; line numbers drift.
2. Replace that button with the existing edit-in-place slots so the owner lands on the real editor (see EipSlot in edit-in-place/bridge.ts: 'photo', 'about-empty', 'card'; the empty section already renders `eip?.slot('create-first-event')`). The empty state copy must still say what the person can do, and must not name a control that is not on screen. Pick the one design yourself; record it and one rejected alternative in two lines each in docs/design/<pr>.md. Taps >= 44px; use explicit px (the site html font-size is ~13.5px on phones).
3. Delete the legacy dialog, its state, handlers and now-unused imports (Dialog*, CityPicker if unused, validators only used there). `saveOrganiserProfile` itself STAYS: edit-in-place draftModel.ts:350 uses it. Do not edit src/lib/organiserProfileUpdate.ts.
4. Update the owner-blank case in visibility.matrix.test.tsx to the new behaviour; add a table-driven test: owner-blank x {flag on, flag off} x {has photo, no photo}: empty state shows an action that reaches an edit-in-place sheet, never the legacy dialog (assert no `Edit profile` dialog title exists anywhere). Red first against unfixed code.
5. Check: tsc 0 errors in touched files; vitest src/pages src/modules/organiser/edit-in-place; npm run check:mojibake; use &mdash;/&rsquo; entities, no raw Unicode punctuation. Files over 2 KB go through scripts/safe-edit.py.
6. Real-data survey (read-only, counts only, Supabase MCP prod stsdtacfauprzrdebmzg): how many organiser rows would show owner-blank (no bio, no photo, no links). Put the count in "Shapes surveyed".

## Do NOT touch
EventCalendar.tsx, calendar/CalendarGrid.tsx, calendar/CalendarListView.tsx, calendar/DayDetailModal.tsx, calendar/calendarUtils.ts, useCalendarEvents.tsx (density-exempt calendar files), src/components/ui/dialog.tsx, supabase/**, migrations, workflows, scripts/**, .env*, src/lib/organiserProfileUpdate.ts, any file not listed under Files (plus docs/design/<pr>.md and the matrix test above).

## Done when
One push; PR body has "## Verified on real data" (- Shapes surveyed: / - Checks run: / - NOT verified:) and "## Phone QA" (- Sizes checked: / - Walked: / - Not verified:); tests green; every CI job step that applies has been run and the per-job table is in the PR body; last commit subject ends with the [worker-done ...] marker. Docs-only or tests-only PR: delete the Phone QA section.
