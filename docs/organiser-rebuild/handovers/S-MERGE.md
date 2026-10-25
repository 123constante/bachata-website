# S-MERGE handover (PR #809, branch claude/org-r1-integrate)

Merged `origin/main` (960fc4c) into the branch (merge commit, no rebase), added the redeem `team_full` entry, walked the screens at 390x844.
`git merge-base --is-ancestor origin/main HEAD` succeeds.

## Resolution table
| File | Hunks | Side | Why |
|---|---|---|---|
| `events/EventEditorPage.tsx`, `__tests__/editor.matrix.test.tsx`, `editorOrder.matrix.test.tsx`, `pages.test.tsx`, `editorOrder.matrix.test.tsx.snap` | modify/delete | DELETED (R1's) | R1 replaced the editor (OneEvent/Details/...); main's only change there was dropping the Type row, which the new editor never had. The snapshot is deleted with its test, so none was regenerated. |
| `events/EventList.tsx` | 4 | R1 row + main's Past/"Nothing coming up" | R1's row (chip, `useOrganiserChoice`, `newWhatFor`) kept; main's Past collapsed section, empty state and `seriesLife` sectioning added; `activeId` wired from `OneEvent`. |
| `events/eventType.ts` | 2 | main (Type row gone) on R1's file | `TypeRowState`, `typeSublabel`, `wordForStored` import removed; `EVERY_UPCOMING_CANCELLED` kept; R1's `CreatableFormat`/`FORMAT_LABELS` kept. |
| `__tests__/eventTruth.matrix.test.tsx` | 2 | R1 (blocks already removed) + main's header/rename | Main's "no Type row over real shapes" block rendered the deleted editor; not ported (the new editor has no Type row to render). |
| `tests/e2e/organiser-events.spec.ts` | 1 | R1 | R1's flow; the `org-row-type` count-0 assertions auto-merged in. |
| `dates/index.tsx` | auto | merged | |

## Type row removal list
`TypeRowState`, `typeSublabel`, `noDateSentence`, `wordForStored` import in `eventType.ts`; the Type `SummaryRow` and FIX-6/FIX-7 Type-row tests (gone with the deleted editor and the R1 test removals). Remaining "Type" labels are session-type fields (`ProgrammeSheet`, `DateSheet`), not an event Type row.

## One life mapping
`jobs/homeJobs.ts` gets `lifeChip` (reads `shared/lifeLabel.ts`): a live series with nothing coming up reads Finished / Nothing coming up; everything else keeps `seriesChip`. My events and One event use it. Home's job row keeps its own actionable "Needs dates". Tests updated: s5.events (Nothing coming up under Past), consistency.render (ended is under Past), lifeLabel.matrix ported to `OneEvent` and R1's row testids; archived shapes are not list rows (R3-4).

## Redeem `team_full` (RED FIRST)
`inviteModel.ts` `REDEEM_COPY.team_full` = `{ title: 'This team is full', body, action: 'home', terminal: true }`.
Tests in `admin-organisers/__tests__/inviteModel.test.ts` ("redeem: team_full").
- Before the entry (same tests, unchanged code): 3 failed, 40 passed.
- After: 126/126 in `src/modules/admin-organisers`.
- Mutation: deleting the entry returns the same 3 reds (that run was the red-first one).
| Rule | Mutant | Result |
|---|---|---|
| every server reason maps to non-fallback | delete `team_full` | red |
| terminal, action home, no retry | delete `team_full` | red |
| copy names no absent control | delete `team_full` | red |

## Checks (sandbox; GitHub Actions not consulted)
| Command | Exit |
|---|---|
| `npm run lint` | 1 -- only link `check:integrity` fails with 126 (script not executable here); `bash bin/check-integrity.sh` exits 0 (1981 files, 0 issues). Every other link green. |
| `npm run typecheck` | 2, 98 errors (baseline 106 in `scripts/pre-ship.mjs`); none in files this PR touches (TeamPicker.test, NewPageFlow.test, OrganiserProfile.tsx pre-exist). |
| `npx vitest run src/modules/organiser src/modules/admin-organisers` | pass (3413 passed, 2 skipped; before the redeem commit; admin-organisers re-run 126/126 after) |
| `npm run test:unit` equivalent (`npx vitest run`) | 1: 15 failed in the four named pre-existing files (eventViewCompat 5, integrityCouldNotRun 5, occurrenceProgram 2, publicEventPageLineup 3) |
| `npm run build` (default, and twice with `VITE_ENABLE_ORGANISER_SELF_SERVE=true`, with and without support env) | 0 |
| Playwright walk `tests/e2e/walk-smerge.spec.ts` (prod build) | pass |
Not run: other workflow jobs (e2e-smoke gate, db-contract-check needs live DB, check:og needs a deploy, check:images AUDIT_STRICT, pre-ship).

## Walk (390x844, prod build, mocked backend) -- `docs/organiser-rebuild/walk-SMERGE/`
a-new-page-invite-required-support, b-new-page-invite-required-no-support (plain line, no dead link, no retry), c-team-full, d-redeem-team-full, e1/e2 events list (Past collapsed/open: Ended, Finished, Nothing coming up), e3 ended, e4 past-dates-only, e5 nothing-coming-up (no Type row). Tap-target audit (>=44px, within 390 wide) over the organiser shell: no findings. On (d) the only flag is the site breadcrumb "Home" (49x17), the global layout, not ours.

## Findings from the walk (not fixed)
- (c) After a server `team_full` on a page the client thought was under the cap, the message shows (`add-error`) but the faces stay tappable (a retry just refuses again). The brief said "no Add"; fixing it is in `team/**` logic, which this slice must not touch.
- Past toggle chevron renders tiny/odd at 390 (visible in e2); cosmetic, from main's #757.

## Decisions I made
- Redeem body is NOT `TEAM_FULL_COPY` ("Remove someone first" names a control a joiner does not have); same cap via `TEAM_CAP`, same support route. `inviteModel.ts` imports `TEAM_CAP` from `organiser/shared/teamModel` (no cycle).
- `lifeChip` rather than editing `seriesChip`: changing `seriesChip` broke the Home-row = chip invariant (homeJobs matrix).
- Archived series stay out of the list (R3-4); main showed them under Past.
- The `walk-smerge.spec.ts` is a throwaway walk, not added to `test:e2e`.

## Verified / Not verified
Verified: merge conflicts resolved with no markers; tests above; production build; browser walk at 390x844 with mocked prod-shaped series.
Not verified: a real phone and keyboard; real Supabase answers (all mocked); the GitHub checks on the new head (PR was DIRTY, may be billing-blocked); the remaining CI job steps listed above.
