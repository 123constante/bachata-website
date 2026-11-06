# Inventory: edit-back-to-checklist
Scope is the editor's return behaviour only (no fields change). Admin app repo is not in this session, so its rows are Not verified.

| # | Item | Where (main, before this change) | Covered |
|---|---|---|---|
| 1 | Title "Edit my profile" | src/modules/dancer-app/screens/edit/EditScreen.tsx:225 | yes (note added under it) |
| 2 | Header Back -> /app/me | src/modules/dancer-app/screens/edit/EditScreen.tsx:222 | yes |
| 3 | Bottom link "Back to Me" | src/modules/dancer-app/screens/edit/EditScreen.tsx:420 | yes |
| 4 | Discard sheet + Discard target | src/modules/dancer-app/screens/edit/EditScreen.tsx:422-436 | yes |
| 5 | focus param (instagram) | src/modules/dancer-app/screens/edit/EditScreen.tsx:186-194 | yes (note text) |
| 6 | Unsaved-edit guard (`leave`) | src/modules/dancer-app/screens/edit/EditScreen.tsx:158 | yes |
| 7 | returnTo sanitiser | src/lib/authRouting.ts:8 | yes (reused) |
| 8 | Public page / admin editor equivalents | not read | no |

Coverage: 7 / 8 (admin and public-page rows not inspected; no returnTo exists there to mirror).
Note: main has no save redirect and no editReturnTo / saveErrorAtButton tests, so only the sanitiser rule is shared.
