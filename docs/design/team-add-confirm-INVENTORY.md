# INVENTORY: the "Add someone" flow (team-add-confirm)

Sources: Website `src/modules/organiser/team/AddSomeone.tsx` (A), `.../browseApi.ts`, `.../teamErrors.ts`,
`shared/teamModel.ts`, `shared/teamRpcApi.ts`. The admin app (`bachata-admin-11april`) and the public page are
not in this session's repo scope, so their rows are GAPs (listed at the end), not guesses.

| # | Item | Where | Today | Change in this PR |
|---|------|-------|-------|-------------------|
| 1 | Who may open the flow (`allowed` = owner or manager) | A:41, A:112-113 `add-read-only` | Member/no role sees a read-only line, no faces | none |
| 2 | Search field, 2-letter minimum, 8 results | A:119, A:132-139 | tap a result = add at once (A:130, `tap`) | tap opens confirm |
| 3 | Faces wall, 3 columns, 44px+ | A:146-170 | tap a face = add at once (A:91-96) | tap opens confirm |
| 4 | Face with `canAdd === false` | A:92 `share(invite(...))` | Invite share, writes nothing | none (no confirm) |
| 5 | Member filtered from wall and results | A:43, A:88, A:90 | filtered by user id and profile id | none |
| 6 | Team full (`teamIsFull`) | A:40, A:117, A:130, A:157 | faces/results disabled, `add-full` line | Add in the confirm is disabled with the same reason |
| 7 | `team_full` race | A:79-82 | `serverFull`, error line stays | panel closes, error line shown, Add stays disabled |
| 8 | Other add errors | A:82 `addErrorMessage` | `add-error` line | panel closes, same line |
| 9 | Mutation | A:73-83 `addTeamMemberByProfile(org, id, 'manager', null)` | one RPC | same args, called from Add |
| 10 | Done screen "<short name> is a Manager" | A:96 `goDone` | after success | unchanged |
| 11 | Page name | A `organiser?.name`, fallback used by invite as 'my page' | | confirm uses "this page" when missing |
| 12 | Face aria-label "Add <name> as Manager" | A:160 | only hint | unchanged; the confirm now states it |
| 13 | Invite link button, search error/retry, show more, short-wall line | A:140-176 | | none |

## GAPs
- GAP: admin app Add-someone flow (field/state list with file:line) not read: repo `bachata-admin-11april` is outside this session's scope. Owner to supply or confirm no admin-side confirm exists.
- GAP: public page has no add flow that I could find in this repo; not separately inventoried.

Coverage: 13 Website rows inventoried, 2 GAPs (admin, public), 0 rows silently skipped.
