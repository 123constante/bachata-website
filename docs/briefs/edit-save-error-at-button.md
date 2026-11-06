# Brief: Show a failed profile save next to the Save button
Brief-version: 2
Branch: claude/edit-save-error-at-button
Lane: normal, Sonnet. Website only; do not touch supabase/, src/modules/dancer-app/api/ or any calendar density-exclusion file
Serves: an organiser or dancer on a weak connection who taps Save changes on Edit my profile (the Instagram row fix lands here) and today sees nothing change at the button
## What main lacks
- A failed save puts its message only in the card at the TOP of the long form; the person looking at the Save button sees no change (walk: docs/walk/onboarding-field-rows, cases 04 and 05) -- grep: edit-save-error
- extends: the top-of-page error card (edit-top-error) must keep working and stay the one place with Try again -- src/modules/dancer-app/screens/edit/EditScreen.tsx
## Files
src/modules/dancer-app/screens/edit/EditScreen.tsx
src/modules/dancer-app/screens/edit/__tests__/saveErrorAtButton.test.tsx (new)
## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. When a save fails with a top-level error (no field to blame), show one short line under the Save changes button with data-testid `edit-save-error`: the same words as the top card, role alert, 44px-safe, no second Try again button (Save itself retries).
2. After the failure, scroll the Save area into view only if the Save button is off screen; never move focus away from the button.
3. The line clears when the person edits any field or taps Save again; a field-level server error (Instagram taken, invalid handle) behaves exactly as today.
## Tests
Table-driven, red first: for each of network failure, HTTP 500, field error (23505), success, untouched save: assert whether `edit-save-error` is present, whether `edit-top-error` is present, how many save calls were sent (untouched save sends 0), and that the line clears on the next edit.
## Done when
- Table above green, and red against unfixed main. Browser walk at 390x844 with a network-failed save: the message is visible at the Save button without scrolling.
- PR body carries a Verified / Not verified block (real-data shapes: a profile with every field filled, and an empty one).
