# W1 S0: people-badges mapping (handover)

Branch `claude/w1-s0-badges` (from origin/main). No PR (sub-branch). Interface exactly as pinned in the brief:
`src/modules/person-page/badges.ts`, tests `src/modules/person-page/__tests__/badges.test.ts`. No other source file touched.

## Done
- parseBadges, usePeopleBadges (chunks of 300, deduped+sorted key, empty = no request), hrefForRole, roleTagsFor, nameFor, linkFor, leadRole.
- Vocabulary/order/hrefs come from `searchEntities.ts` (`ROLE_LABEL`, `ROLE_ORDER`, `orderedRoles`, `hrefFor`); no second copy. `ROLE_ORDER` is teacher, dj, dancer, so tags read Teacher, DJ, Dancer.
- Teacher tag shows as plain text (href null) while `teacherPagesOpen` is false. linkFor: DJ, else dancer, else teacher only if open, else null.

## Measured RPC shape (prod, one read-only call)
`get_public_people_badges_v1(uuid[])` returns a jsonb ARRAY of
`{"id":"<uuid>","roles":["dj","dancer"],"dj_name":null,"next_gig_date":null,"dj_has_upcoming":false}`.
NOTE: `roles` already uses the public vocabulary `teacher` / `dj` / `dancer` (not dancing/djing/teaching as the brief said). parseBadges accepts both spellings and drops everything else. Ids with no public row are simply absent from the array.

## Prod survey (all 160 dancer_profiles ids, counts only, 2026-10-20)
| roles | people | DJ w/ upcoming | has dj_name | dj_name starts "DJ" | dj_name differs from display_name |
|---|---|---|---|---|---|
| teacher only | 62 | 0 | 0 | 0 | 0 |
| dancer+teacher | 36 | 0 | 0 | 0 | 0 |
| dancer+dj+teacher | 25 | 11 | 6 | 2 | 5 |
| dancer only | 21 | 0 | 0 | 0 | 0 |
| dancer+dj | 10 | 3 | 4 | 2 | 4 |
| no public role (row returned, roles empty) | 5 | 0 | 0 | 0 | 0 |
| dj only | 4 | 2 | 1 | 1 | 0 |
| dj+teacher | 1 | 1 | 0 | 0 | 0 |
Totals: 40 DJs (17 with an upcoming gig), 62 teacher-only (unlinked while the flag is off), 5 people with an empty role list (no link, no tags).

## Tests
Table: 12 shapes x teacherPagesOpen false/true x (labels, stage-name labels, link, lead role, tag hrefs) plus cross-table invariants. 30 tests, green.
Mutants (each reverted afterwards), command `npx vitest run src/modules/person-page/__tests__/badges.test.ts`:
- M1 teacher href while closed (guard removed in hrefForRole): RED, 4 failed.
- M2 dancer before DJ in linkFor: RED, 6 failed.
- M3 stage name used in 'other' context: RED, 1 failed.
- Reverted: GREEN, 30 passed.

## Gates (local; sandbox)
| job | command | result |
|---|---|---|
| unit (new file) | vitest run badges.test.ts | 0, 30 passed |
| unit (all) | npx vitest run | 15 failed / 10247 passed: tests/eventViewCompat.contract, occurrenceProgram.contract, publicEventPageLineup.contract (live-DB contracts), integrityCouldNotRun (env). None touch this change. |
| eslint (changed files) | npx eslint badges.ts badges.test.ts | 0 |
| rpc-typing | npm run check:rpc-typing | 0 |
| wallclock-brand | npm run check:wallclock-brand | 0 |
| typecheck | tsc --noEmit -p tsconfig.app.json | exit 2, 114 errors both on main and on this branch (pre-existing, none in badges files) |
| build | npm run build (production) | 0 |

## NOT verified / NOT RUN
- GitHub Actions jobs (no PR, so none queued). Docker / local Supabase, browser walk, real phone: NOT RUN (no UI in this slice).
- usePeopleBadges not exercised against a live render (only the pure functions are tested); the supabase call is cast like reads.ts does.
- Pre-push review stamp / `pre-ship` not run.

## Left for S1-S4
Wire surfaces to these functions; read `flags.teacherDetail` for `teacherPagesOpen`.
