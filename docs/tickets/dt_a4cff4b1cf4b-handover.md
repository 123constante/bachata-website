# Handover dt_a4cff4b1cf4b: edit-save-error-at-button

Done: `edit-save-error` line under Save changes (role alert, min-h 44px, same words as the top card, no second Try again); top card unchanged; line clears on edit or Save again; Save area scrolled into view only when off screen, focus never moved. Tests: `screens/edit/__tests__/saveErrorAtButton.test.tsx` (9; 6 red on unfixed main, 9 green). INVENTORY: `docs/briefs/edit-save-error-at-button.INVENTORY.md` (11/11 in-scope items).

Verified: vitest src/modules/dancer-app 948 passed; check:mojibake clean; tsc -p tsconfig.app.json: 0 new errors in branch files (2 pre-existing "Duplicate identifier lazyWithRetry" in EditScreen.tsx on main, imports at lines 11 and 19, not touched here).

Not verified: browser walk at 390x844 (no browser walk run); shape survey of prod data (Supabase not queried; fixtures fourFieldComplete only, no empty-profile run); real 23505 (client has no 23505 mapping, a field-naming code invalid_instagram stands in); admin app / public page inventory (not in this repo); full CI job set, pre-ship, code-review round not run; no PR opened.
