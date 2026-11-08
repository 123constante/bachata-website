# Inventory: line-up search, no-match state

Surfaces: admin app (not readable from this sandbox, see Not covered), current Website, public page.

| # | Item | Where | Covered |
|---|---|---|---|
| 1 | Role toggle Teacher / DJ (`ADD_ROLES`) | src/modules/organiser/p3/screens/LineupSheet.tsx:12, :82-84 | yes (matrix, both roles) |
| 2 | Search input, `PEOPLE_SEARCH_MIN` gate | LineupSheet.tsx:86-88 | yes (short cell) |
| 3 | Hint under minimum length | LineupSheet.tsx:89 (`L.searchHint`) | yes |
| 4 | Search error alert | LineupSheet.tsx:90 | yes (error cell, no link) |
| 5 | Results list | LineupSheet.tsx:94-100 | yes (found cell, no link) |
| 6 | No-match note `L.noMatch` | LineupSheet.tsx:92; src/modules/organiser/p3/model/labels.ts:204 | yes, unchanged |
| 7 | No-match control (was absent) | LineupSheet.tsx, `p3-lineup-ask-team` | yes, added |
| 8 | Session that takes no people (`teamOnly`, no search) | LineupSheet.tsx:77; programmeSeriesModel `addRoleFor` | yes (noPeople cell) |
| 9 | Contact link builder | src/lib/contactLinks.tsx:36 `dancerMessageUsUrl` | reused, not edited |
| 10 | Public page: line-ups are read-only, no search | src/modules/event-page (read-only) | n/a, no control to add |

Coverage: 9 of 9 Website rows covered (row 10 n/a). Not covered: admin app line-up editor (repo `bachata-admin-11april` not in this session).
