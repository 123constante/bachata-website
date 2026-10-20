# FIX-SW1 handover -- the one fix pass on SW1 from REVIEW-SW1 (Website)

- Ticket `dt_f80eee0febdc`. Branch `claude/org-r1-parity-sw1-fix`, cut from `claude/org-r1-review-SW1` @ 684d325 (SW1 d20de737 + the review).
- Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/FIX-SW1.md` (sha 89e14a1) + `AW1-addendum-B1.md`.
- Status: **DONE** for every brief item. `AW1_APPLIED` stays **false** (B1 needs AW1's upsert-by-id writer on prod before the gate flips).

## Done

| # | Finding | What changed | Where |
|---|---|---|---|
| 1 | B1 (client half) | `buildDays` sends the stored `id` of every day, section and item (`idOf(raw)`); a new row sends none. With AW1's upsert-by-id writer (addendum B1), a rename / move / time change keeps every `event_occurrence_session_override_p5` row; deleting an item drops only its id. Delete confirm now reads: "Remove &ldquo;X&rdquo; from every date? Any date where you changed this session loses that change too. It comes off when you save." (`removeConfirmCopy`). The differs card: "Those dates keep their own changes when you edit a session here. Removing a session takes its date changes with it." | `programmeSeriesModel.ts`, `ProgrammeSeries.tsx` |
| 2 | B2 | `setPersonRole` never touches `profileType`, and only accepts a role the type can hold (`rolesFor`: teacher -> teaching, dj -> djing, others none). The sheet offers only fitting role chips, so with today's types a stored person has no role chip (the role word stays on the row). `addPerson` takes the picked profile's `profileType` and refuses a role it cannot hold. | `programmeSeriesModel.ts`, `ProgrammeSheet.tsx` |
| 3 | S1 | `recent_people` pinned as `{profile_id, profile_type, display_name, photo_url, roles[]}` (`parseRecentPeople`; a row with no `profile_type` is left out, never guessed). RECENT for a session lists people whose OWN type holds the session's role (`recentFor`), so a role-less DJ shows on a party, a teacher who also DJs shows on a class, each added with their own type. | `programmeSeriesModel.ts`, `programmeSeriesApi.ts`, `ProgrammeSheet.tsx` |
| 4 | S2 | A section stored empty is sent back as stored (`PSection.storedEmpty`); only a section this screen emptied is dropped. SW1 handover decision 4 updated. | `programmeSeriesModel.ts`, `handovers/SW1.md` |
| 5 | S3 + N3 | ONE renderer `shared/components/LevelText` (short chip, aria-hidden, then the word) used by the programme rows, the series sheet (session + person levels) and `dates/DateSheet`. `LEVEL_SHORT` moved to `shared/programmeModel`. The legend line is gone (the word is on every chip). | `LevelText.tsx`, the three screens |
| 6 | S4 | Details cast empty state = `castEmptyLine(programmeOff(...))`: the reason (festival / ended / viewer / gate off) when the programme cannot be edited, the call to action only when it can. | `Details.tsx`, `programmeSeriesModel.ts` |
| 7 | S5 | No raw Unicode punctuation: `–` in `timeLine`, `·` in the row/festival lines, `“”` in the confirm. `check:mojibake` 0. | model, `ProgrammeSeries.tsx` |
| 8 | S6 | Cast line = first 6 names + "and N more" (`CAST_MAX`). | `programmeSeriesModel.ts` |
| 9 | N4 | Programme shows a skeleton until `organiser_home_v1` returns the role. | `ProgrammeSeries.tsx` |
| 9 | N5 | Organisers empty state: owner who can link reads "Use Link a page below to add yours."; anyone else (manager, gate off, closed) the team copy (`organisersEmpty(off)`). | `organisersModel.ts`, `SeriesOrganisers.tsx` |
| 9 | N1 | **Left as is** per the brief: a blank title is sent as `''` (239 stored items). Readers treat `''` and null alike. | -- |
| 10 | appendix | Reviewer test merged verbatim as `events/__tests__/review-sw1.echo.test.ts` (6/6 green). | |

Tests: new `events/__tests__/fixSw1.matrix.test.tsx` (52 cases: B1 edit table x ids + override survival, B2 every stored person shape x every offered role, S1 parse + RECENT per role, S2, S3 render + scan of the three screens, S4 every off reason, S6, N5, S5 scan); `sw1.parity.test.tsx` gained the N4 skeleton test, the delete-confirm copy test and the ended / gate cast empty states; `parity-matrix.test.ts` key sets now pin `id` on day / section / item.

## Not changed (deliberate, for the finishing worker)

- **People rows send no `id`.** The brief asks for day / section / item ids; the reviewer's echo test pins the person keys `{profile_id, profile_type, role, level, sort}`. The addendum says people rows are upserted by id "when the payload carries `id`", so AW1 must also accept people without one (replace an item's people by position). If AW1 wants people ids too, add `...idOf(p.raw)` and the key to `PROG_PERSON_KEYS` + the echo test.
- The screen still hides empty stored sections (it now sends them back).
- `parseTree` still defaults a missing stored `profile_type` to `teacher` (prod: 0 missing).

## Red first (new tests against the UNFIXED code, d20de737 + a null `LevelText` stub so the file collects)

```
 Test Files  2 failed (2)
      Tests  38 failed | 20 passed (58)
 FAIL review-sw1.echo > known gaps > switching a teacher to DJ keeps the profile_type ...  expected { profile_id: 't1', ...(4) } to match object { ..., profile_type: 'teacher' }
 FAIL review-sw1.echo > known gaps > an empty stored section survives a save           expected [ 'party' ] to deeply equal [ 'classes', 'party' ]
 FAIL review-sw1.echo > known gaps > the item id is sent ...                           expected { title: 'T a', ... } to have property "id" with value 'a'
 FAIL fixSw1 > B1 > untouched / rename / move / change a time / delete                  expected [ undefined, undefined, undefined ] to deeply equal [ 'a', 'b', 'c' ]
 FAIL fixSw1 > B1 > day and section ids are sent                                        expected undefined to be 'd0'
 FAIL fixSw1 > B1 > the remove confirm ...                                              removeConfirmCopy is not a function
 FAIL fixSw1 > B2 > teacher/teaching -> tap djing                                       expected 'dj' to be 'teacher'
 FAIL fixSw1 > B2 > dj/djing -> tap teaching                                            expected 'teacher' to be 'dj'
 FAIL fixSw1 > S1 > parses ...                                                          expected [] to deeply equal [ [ 'p-t', 'teacher', ...
 FAIL fixSw1 > S2 > untouched                                                           expected [ 'classes', 'party' ] to deeply equal [ 'classes', 'party', 'masterclass' ]
 FAIL fixSw1 > S3 > ProgrammeSeries / ProgrammeSheet / DateSheet                       expected 'import ...' to match /<LevelText /
 FAIL fixSw1 > S4 > festival / ended / viewer / gate off                                castEmptyLine is not a function
 FAIL fixSw1 > S6 > 7 people / 76 people                                                expected false to be true
 FAIL fixSw1 > N5                                                                       organisersEmpty is not a function
 FAIL fixSw1 > S5 > programmeSeriesModel.ts                                             expected [ '–' ] to deeply equal []
 FAIL fixSw1 > S5 > ProgrammeSeries.tsx                                                 expected [ '·', '·' ] to deeply equal []
```
After the fix: 58/58; organiser module 111 files, 3501 passed, 2 skipped.

## CI, every step run locally on the head (sandbox)

| Job | Step | Exit |
|---|---|---|
| architecture-guard | `chmod +x bin/*.sh`; `bin/check-integrity.sh`; `check:legacy-tables`; `check:legacy-program-rpcs`; `lint:architecture` | 0 / 0 / 0 / 0 |
| architecture-guard | `AUDIT_STRICT=1 check:images`; `check:image-widths` (+self-test); `check:workflow-artifact-policy` (+self-test); `check:plan-hygiene:self-test`; `check:mojibake:self-test`; mojibake `git grep`; `prove:entry-point` (+self-test) | all 0 |
| (extra) | `npm run check:mojibake` | 0 |
| typecheck | `check:rpc-typing` / `check:wallclock-brand` | 0 / 0 |
| unit-tests | `npm run test:unit` | 1: 16 failed / 9505 passed. 15 = the known sandbox reds (live-DB contracts `eventViewCompat` 5, `occurrenceProgram` 2, `publicEventPageLineup` 3; `integrityCouldNotRun` 5, temp-repo precondition). 1 = `tests/client/festivalClientState.test.tsx`, passes alone (8/8): load timing, file untouched |
| unit-tests | `check:dancer-area-isolation` (+self-test) | 2 on a stale local `origin/main` ("could not measure"); 0 after `git fetch origin main` |
| lint | `npm run lint` | 0 (chain green) |
| perf-budget | 3 self-tests; `npm run build`; `check:bundle-budget`; `check:first-load-requests`; `check:chunk-cycles` | all 0 |
| perf-budget | `check:doc-weight` | 1: needs `GITHUB_REPOSITORY` + a live preview (sandbox-only) |
| perf-budget | `check:lighthouse` | not run (needs a live deploy) |
| e2e-smoke | `npm run test:e2e` | 1: 156 passed, 2 failed (`dancer-home.spec.ts:168` and `:188`, flows @390, timeouts); re-run alone 8/8 passed. Same class the reviewer saw; specs untouched |
| workflow-lint | masking, notification (+self-test), no-preview-prefixes (+self-test) | 0 |
| ci-budget-guard | self-test 0; guard 2 (needs `CI_BUDGET_GITHUB_TOKEN` secret) | sandbox-only |
| db-contract-check | `check-migration-stamps.mjs` | 0 (the rest need DB secrets) |
| eslint (changed files) | `npx eslint <the 12 changed files>` | 0 |

## 390x844 walk (PRODUCTION build, `VITE_ENABLE_ORGANISER_SELF_SERVE=true`)

`tests/e2e/walk-fix-sw1.spec.ts` (throwaway, NOT in the gate list), route-mocked organiser fake carrying a prod-shaped weekly series: 2 classes (levels B + IM, a person level) + a party ending next day + an EMPTY stored masterclass section, per-date overrides on 2 dates ("Differs on 2 dates"), RECENT with a teacher, a dual-role teacher and a role-less DJ. Gate off: shipped build (2 passed, 1 skipped). Gate on: throwaway build with `AW1_APPLIED=true` (reverted; not committed): 3 passed. The gate-on Save was captured from `series_command_p5`: it carries `d1`, `s1`, `s2`, `s3` (the empty one) and `i1` `i2` `i3`, and the RECENT teacher as `profile_type teacher / teaching`; RECENT on a class lists the 2 teachers, not the DJ; the sheet shows no DJ chip for a teacher. Shots: `docs/organiser-rebuild/walk-FIX-SW1/`.

## Verified / Not verified

**Verified:** prod shapes (read-only SELECT, 2026-10-18): 89 overrides on 19 series, 90 empty sections, people shapes dj/djing 79, teacher/teaching 203, teacher/mc 1, dancer/performing 1 (each in the B2 matrix), `organiser_series_cast_v1` absent on prod (0), max 31 people rows on one series (cast clamp at 6 applies); the red-first run above; the organiser suite; every CI step in the table; a production build; the 390x844 walk with the gate off and on, including the Save payload's ids.

**Not verified:** AW1 itself (the upsert-by-id writer and `recent_people.profile_type` are the sibling worker's; until it ships the ids are sent but a pre-AW1 writer would still delete-and-reinsert, so **keep `AW1_APPLIED=false`**); a live save (writers are admin-only on prod); whether the admin editor hits B1 today (admin repo not reachable from here); real phone; real names and photos (the walk is prod-SHAPED, route-mocked); `check:lighthouse`, `check:doc-weight`, the DB contract workflow, `ci-budget` (secrets / live deploy).
