# INVENTORY: teaching rows on Review (brief teach-row-returns-to-review)

Scope note: the admin app (`bachata-admin-11april`) is not in this checkout and was not readable; its column is NOT inventoried (see Not verified). Website and public page only.

| # | Item | Where | Covered |
|---|------|-------|---------|
| 1 | Review row teach_styles -> step `styles` | pageModel.ts:320 | yes |
| 2 | Review row teach_years -> step `years` | pageModel.ts:321 | yes |
| 3 | Review row teach_levels -> step `levels` | pageModel.ts:322 | yes |
| 4 | Row tap routes to person step | OnboardingFlow.tsx:271 (`onRow`) | yes |
| 5 | Person path (first-time) unchanged | personModel.ts:23 `personPath` | yes (existing tests untouched, green) |
| 6 | Lone-step path | personModel.ts:30 `teachRowPath` | yes |
| 7 | Path choice in screens | PersonFlow.tsx:172 | yes |
| 8 | Save -> next/onDone | PersonFlow.tsx:227 | yes |
| 9 | Back -> onExit (Review) | PersonFlow.tsx:186, OnboardingFlow.tsx:244 | yes |
| 10 | Bar held at Review percent | OnboardingFlow.tsx:242 | partial (value passed; not asserted in a test) |
| 11 | Answer step `teach` and `name` entry unchanged | tests, matrix | yes |
| 12 | teach = No hides levels/styles/years (not reachable from Review) | personModel.ts:23 | yes (excluded in table) |
| 13 | Public page teaching fields | not inspected | no |

Coverage: 11 covered, 1 partial, 1 not inspected, of 13.
