# Brief: the Instagram field must not say "Saved as" before anything is saved

Brief-version: 2
Branch: claude/instagram-hint-before-save
Lane: normal, Sonnet. Website (123constante/bachata-website), the shared Instagram field only; must not touch src/modules/dancer-app/screens/edit/EditScreen.tsx (another worker owns it), the refusal words in src/modules/dancer-app/api/errors.ts, or the calendar density-exclusion files.
Serves: a new organiser or dancer typing their Instagram on a slow connection, who today sees "Saved as simon.bachata" while the save is still running or has failed.

## What main lacks
- extends: the hint under a typed handle says "Saved as {handle}" the moment it is typed; it is a preview and must read as one -- src/components/forms/InstagramInput.tsx
- Wording that names the preview: "Will save as {handle}" -- grep: Will save as
- A table-driven test that pins the hint wording for every field state (untouched, typed valid handle, pasted link, invalid, error from the server) -- grep: instagramHint.matrix

## Files
src/components/forms/InstagramInput.tsx
src/components/forms/__tests__/instagramHint.matrix.test.tsx (new)

## What to build
0. Write INVENTORY.md first: every field, state and option from the admin app, the current Website and the public page, each with file:line. Build only after it exists and report the coverage count (covered / total) at the end.
1. Change the hint line to "Will save as {handle}" (British English, one sentence, no emoji); keep the tick line, the check link and every test id unchanged.
2. Prove no other place renders the old wording: grep src for `Saved as ` and list each hit in the PR body with why it is a different thing (draft messages are not the Instagram hint).
3. The hint is hidden whenever a server or form error is shown (already true; the test pins it).

## Tests
`instagramHint.matrix.test.tsx`, table-driven, red first on current main: value x stored x error -> expected lines (untouched: nothing; "@simon.bachata", "simon.bachata", "https://instagram.com/simon.bachata/": hint "Will save as simon.bachata"; "a b": local error, no hint; valid + server error: error only, no hint). Run the existing tests that import InstagramInput (EditScreen tests, wizard contactSteps tests) and update only assertions on the old words.

## Done when
Matrix green and red on unfixed main; existing InstagramInput consumers' tests green. PR body has a Verified / Not verified block: 390x844 look at the wizard Instagram step and the /app edit field typing a handle, coverage count from INVENTORY.md; Not verified: real slow-network save.
