# Brief: The profile editor opened from the checklist goes back to the checklist
Brief-version: 2
Branch: claude/edit-back-to-checklist
Lane: normal, Sonnet. Website only; do not touch supabase/, saving logic, field validation, or any calendar density-exclusion file
Serves: an organiser whose last checklist item is "Your Instagram" and who is sent into the whole dancer profile editor with no word about why or how to get back
## What main lacks
- Opened from a checklist row (?returnTo= set) the editor still says only "Edit my profile", and its header Back and "Back to Me" link go to /app/me, not to the checklist the person came from (walk: docs/walk/onboarding-field-rows, case 01 and ranked stop 4) -- grep: edit-return-note
- extends: a Back that honours a valid returnTo, still behind the Discard changes sheet when there are unsaved edits -- src/modules/dancer-app/screens/edit/EditScreen.tsx
## Files
src/modules/dancer-app/screens/edit/EditScreen.tsx
src/modules/dancer-app/screens/edit/editModel.ts
src/modules/dancer-app/screens/edit/__tests__/editReturnTo.test.tsx
src/modules/dancer-app/screens/edit/__tests__/editReturnBack.matrix.test.tsx (new)
## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. With a valid returnTo (sanitizeReturnTo, same rule as the save redirect), show one plain line under the title, data-testid="edit-return-note": "Save your changes and you come straight back to where you were." Without returnTo the screen is unchanged.
2. With a valid returnTo, the header Back and the bottom link go to returnTo and the bottom link reads "Back to where you were"; without it they stay on /app/me and "Back to Me". Unsaved edits still open the Discard changes sheet first, and Discard then goes to the same target.
3. With focus=instagram the line names the field: "Add your Instagram, then save." followed by the sentence above.
## Tests
Table-driven, red first: returnTo (none, valid P3 review path, the editor itself, off-site, malformed) x focus (instagram, none) x unsaved edits (yes, no): assert the note text, both Back targets, the bottom link label and the Discard target. Existing editReturnTo and saveErrorAtButton tests pass untouched.
## Done when
- Table green and red against unfixed main.
- Walk at 390x844: Review, tap Your Instagram, see the note, tap Back, land on Review. Verified / Not verified block in the PR body.
