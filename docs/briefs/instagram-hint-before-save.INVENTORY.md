# INVENTORY: Instagram field states (instagram-hint-before-save)

Scope: the shared field only. The admin app (bachata-admin-11april) is a separate repo not attached to this session; its rows are listed as not inventoried.

| # | Surface / state | Where | Status |
|---|---|---|---|
| 1 | Shared field, box equals stored value: nothing checked | src/components/forms/InstagramInput.tsx:48 | covered (matrix) |
| 2 | Typed valid handle: tick line, hint, check link | InstagramInput.tsx:80-93 | covered (matrix) |
| 3 | Pasted profile link normalises to bare handle | InstagramInput.tsx:49 | covered (matrix) |
| 4 | Invalid value: local error, no hint | InstagramInput.tsx:50,106 | covered (matrix) |
| 5 | Valid value + server error: error only, no hint | InstagramInput.tsx:52,79 | covered (matrix) |
| 6 | Old wording "Saved as {handle}" | InstagramInput.tsx:83 | changed |
| 7 | Consumer: dancer edit screen | src/modules/dancer-app/screens/edit/EditScreen.tsx (not edited) | existing tests run |
| 8 | Consumer: wizard contact step | src/modules/organiser/wizard/contactSteps.tsx | existing tests run |
| 9 | Public page rendering of Instagram | not a hint surface; no "Saved as" text | n/a |
| 10 | Admin app Instagram field | other repo, not attached | NOT inventoried |

Coverage: 8 covered or changed / 10 total (rows 9 n/a, 10 not inventoried).
