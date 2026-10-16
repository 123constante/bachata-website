# Handover: slice 3b merged into `claude/account-grid` (PR #775)

## Merge result
`git merge --no-ff origin/claude/account-grid-3b` (9eedb90) onto `claude/account-grid` (c30e9d3, as expected). No conflicts.

## Fixes
| Item | Change |
|---|---|
| S1 | `src/components/account/profiles/__tests__/deletionWiring.test.tsx`: real `useProfileSides` and real `ContinueAsScreen`; pending -> `restore`, expired -> `deleted-card`, none -> null, hang -> `loading`; screen navigates to `/account/restore` and shows `continue-as-loading` without navigating. 7 tests. |
| S2 | `accountGate.test.tsx`: 11 direct `composeAccountGate` rows (the 5 asked for plus the signed-out variants, loading+null, error+null). |
| S3 | `docs/account-system/DECISIONS.md` under D4: "a finished dancer is never sent back into setup"; 100% goes straight on, 70-99% sees the end card; changing it needs a dancer-app-only PR. |
| Isolation | `notes.tsx` restored byte-for-byte from origin/main. `git diff --name-only origin/main...HEAD` lists no `src/modules/dancer-app/` file. **The slice-3c comment update in that file goes in a later dancer-app-only PR.** |

## Mutation proofs
- `useProfileSides.ts` deletion line replaced with `deletion: null,` -> `deletionWiring.test.tsx`: "Tests 5 failed | 2 passed (7)" (pending, expired, loading, and both screen-navigation cases fail). Restored.
- `composeAccountGate`: `loading` branch placed before `deleted` -> "Tests 2 failed | 42 passed (44)" (`completion loading + restore -> deleted`, `completion loading + deleted-card -> deleted`). Restored (`git checkout`).
(`completion error + restore` passes under that swap because error is not `loading`; the row guards the fail-closed path.)

## Commands
| Command | Exit | Result |
|---|---|---|
| `npm run build` | 0 | built |
| `check:bundle-budget` | 0 | |
| `check:first-load-requests` | 0 | |
| `npm run typecheck` | 2 | 96 errors = base c30e9d3 (96); none in changed files |
| `npx eslint` (4 changed files) | 0 | clean after fixing one react-hooks/globals error in my new test |
| `bash bin/check-integrity.sh` | 0 | |
| `npm run lint` | 1 | only link failing: `check:integrity` exit 126 (hook script not executable in this container; passes run directly). eslint link skipped by the chain |
| `check:journey-grid` | 0 | 87 rows |
| `check:dancer-area-isolation` | 0 | "not a dancer-area PR: rule c only" / "dancer-area isolation: OK" |
| `vitest run --pool=forks` | 1 | 59 failed / 8491 passed. All 59 fail identically on c30e9d3: `organiser/dates/DatePage` (8), `levelsByType.matrix` (36), `tests/eventViewCompat.contract` (5), `integrityCouldNotRun` (5), `occurrenceProgram.contract` (2), `publicEventPageLineup.contract` (3) (contract ones need live DB / network) |
| playwright `e2e/account-settings` | 0 | 9 passed |
| playwright build config: account-delete, auth-consent, public-journeys | 0 | 43 passed |

## Verified / Not verified
Verified: everything in the tables above; mutation proofs; isolation.
Not verified: GitHub Actions / Vercel preview (no access); browser walk on a phone with prod data; no Supabase prod-shape survey (no new screen). Last eslint run covered changed files only, not the whole repo. `origin/main` has moved on (070c320) since the base; not merged in.
