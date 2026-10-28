# Brief: Languages field (dancer edit) + picker search height

Repo: 123constante/bachata-website. Branch: claude/languages-field (new, from main at 6615630 or later).
Lane: normal (Website, visible UI change, NO database change). Model: Sonnet. Output: one PR, one push, handover.
Do not merge. No Supabase write, no migration, no prod write. Never --no-verify. Never gh api (stalls): plain git only.

## Decisions already made by the owner (do not re-open)
- Languages UI: Option A, a searchable list with tick boxes, full world language list, no "Other". Chosen mockup:
  https://claude.ai/artifact/RyHVnR22AYtK2BjHLk72eZ (OptionA.dc.html). Tokens/layout follow the existing dancer edit screen.
- Save: keep the SAME stored value as today: ticked languages joined with ", " into the existing text field
  (no new column, no migration). The current field is "Languages (separate with commas)" in
  src/modules/dancer-app/screens/edit/EditScreen.tsx.
- Also raise the nationality picker search box from 37 px to 44 px tall (src/components/ui/nationality-picker.tsx, the
  search input). Same change, same PR.

## Task
1. Read the current languages field and its save path in EditScreen.tsx and the payload builder it uses. Confirm the
   save RPC accepts the comma text (save_my_dancer_profile_v1 or its caller). If it does not, STOP and report PARTIAL.
2. Build the tick-box list: a searchable list, each language a row with a checkbox at least 44 px tall, selected ones
   shown as chips above the list, search filters as you type, a letter-group header per initial (A-Z) so it scans.
   The full language list is a static constant (ISO 639-1 English names, no "Other"). Do not add a new npm dependency
   unless it is already in package.json. Keep the constant lazy-loaded (imported only by the edit screen) so the
   dancer-app first-load chunk does not grow.
3. Picker search input: height 44 px (min-h-[44px]); no other picker change.
4. Save path: an untouched save sends NOTHING for languages; a changed selection sends the joined string only.
   Parse the stored string back into ticks (split on commas, trim, match against the list; keep unknown values
   visible as ticks so nothing is lost on save).
5. Design record: create docs/design/<pr>.md linking the mockup above, the tokens used, and the 390x844 checks
   (contrast >= 4.5, taps >= 44 px, no clipping, no sideways scroll, empty state says what the person can do).
   The design-record Stop hook is not written yet: apply the stages by hand and say so in the PR body.

## Tests (red first where it fixes something)
- Table test: stored values (empty, null, "English", "English, Spanish", an unknown name, a long list) through
  parse -> tick state -> join: no crash, no lost value, round-trip stable.
- Save test: untouched save sends nothing for languages; changed selection sends exactly the joined string.
- Search test: filter matches case-insensitively, empty result shows a line that says what to do.
- Picker height test: the nationality search input is at least 44 px.
- Run the targeted vitest files plus tsc --noEmit. Name anything you could not run.
- npm run check:bundle-budget on main and on the branch: must add 0 B to the dancer-app first load. Never edit
  perf-budgets.json or vite.config.ts.

## PR body (required)
- "## Verified on real data": three labelled lines (shapes, checks run, NOT verified). Shapes: the tests above;
  the orchestrator will walk prod-shaped data at 390x844 after you finish.
- Per-job CI table with every CI job step run in your sandbox where possible.
- The design record link.

## Stop rules
- Stop on any NEW red (green on main): report the exact error.
- Do not add the run-ci label. Push once. Do not merge.

## Required output
Final line: `DONE <head sha>` or `PARTIAL <what is left>`, with the bundle numbers (before/after) and the test counts.
