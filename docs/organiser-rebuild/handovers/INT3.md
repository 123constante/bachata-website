# INT3 handover -- P-DATES + P-SERIES integrated into `claude/org-r1-integrate` (parity pass)

- Ticket: dt_16202d3e1908 (retry; the first INT3 worker never pushed). Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/INT3-parity-merge.md` (abf90b24).
- Base e04dea00. Checkpoint push 71903ee3 (`[skip preview]`); final push = the `[worker-done dt_16202d3e1908]` commit on top.
- Not done by design: `A1_APPLIED` stays `false` (merge train flips it); no new PR (#809 tracks this branch).

## 1. Merges

| step | result |
|---|---|
| `git merge origin/claude/org-r1-parity-dates` (fb525cc8) | fast-forward, clean |
| `git merge origin/claude/org-r1-parity-series` (e0cd03cb) | merge commit d3985fb8, **no conflicts** (OneEvent.tsx, seriesCommands.ts, paths.ts auto-merged; `shared/a1Gate.ts` byte-identical) |
| `git grep -n "<<<<<<<"` | empty |

Both behaviours kept: P-DATES coming-date rows + Sessions links + Past dates on One event, P-SERIES LifecycleActions mount on the same page (walk 01/02 + P-SERIES walk 7/7 on the merged build).

## 2. Parity matrix (`__tests__/parity-matrix.test.ts`)

The 15 `it.todo` rows are real rows now; the `owner: 'P-DATES'` marker and the `P_DATES(...)` helper are gone; a bulk write is checked against its own prod snapshot (`PROD_BULK_KEYS`, from P-DATES's read of `admin_bulk_occurrence_command_p5`).

| id | verdict | screen | command (kind + keys) / read | reached from |
|---|---|---|---|---|
| C13 | MATCH | dates/index.tsx | `organiser_set_occurrence_programme_v1` (selfServeApi) + get read | One event, Change which-date, Change what (`ORG_PATHS.dateLineup`) |
| C19 | MATCH | flows/change/Time.tsx | `occurrence.set_time {new_local_start,new_local_end}`; `previewTimes(` | WhatChanges `changeTime` |
| C20 | PARTIAL | flows/change/Day.tsx | `occurrence.move_date {to_date}` behind A1 (Day.tsx gate) | WhatChanges `changeDay` inside `A1_APPLIED && (` |
| C22 | MATCH | dates/index.tsx | programme save; Add a teacher / Add a DJ | same as C13 |
| C24 | MATCH | flows/change/TakeOff.tsx | `series.skip_date {occurrence_id}` | WhatChanges `changeOff` (+ `isRuleDate(`) |
| C26 | MATCH | flows/change/Detail.tsx | `occurrence.set_override {description}` / `{ticket_url}` / `{cover_image_url}`; `{key:null}` | WhatChanges `changeDetail` |
| C39 | MATCH | events/OneEvent.tsx | coming rows + `pastOnly` DatesList, "Past dates (" | Home jobs `ORG_PATHS.event` |
| C52-C55 | MATCH | dates/index.tsx | programme save; Name/Type/Starts/Ends, levels, Add a session, Remove from this date | same as C13 |
| C58 | MATCH | flows/change/Pick.tsx | `occurrence.bulk_cancel {occurrence_ids,reason}`, `occurrence.bulk_shift {occurrence_ids,shift_days}` via `rpc('admin_bulk_occurrence_command_p5'` | WhichDate `changePick` |
| C59 | MATCH | dates/index.tsx | `NOT_EDITABLE_COPY` | same as C13 |
| C60 | MATCH | flows/change/Copy.tsx | `occurrence.set_override` one per key (`{description}`, `{venue_id,city_id}`) | WhatChanges `changeCopy` |
| C61 | PARTIAL | flows/change/Time.tsx | `occurrence.set_time {reset}`; `set_override {key:null}` | WhatChanges `changeTime` (proxy misses an end-only change, P-DATES decision 5) |

**Counts (pinned by a test): MATCH 43, PARTIAL 5, MISSING-ADMIN-ONLY 11, DROPPED-BY-DECISION 7, MISSING-ALLOWED 0, todo 0** (66 rows). Suite: 266/266.

**Proved it can fail** (mutation: C24 built `occurrence.move_date` with no A1 gate; C26 screen pointed at a file no route reaches), then restored -> 266 pass:
```
Failed Tests 6
FAIL ... 'C24' 'Take a date off (break week)' ('MATCH') > skipDateCommand( builds exactly its kind and keys, all in the prod owner snapshot
AssertionError: occurrence.move_date is refused on prod (BROKEN-ON-PROD) and has no A1 gate: expected undefined to be truthy
FAIL ... 'C26' ... > its screen is reached from a route in OrganiserRoutes
AssertionError: flows/change/parts.tsx.orphan exists: expected false to be true
AssertionError: flows/change/parts.tsx.orphan is in no routed module's import closure: expected false to be true
Tests 6 failed | 260 passed (266)
```

## 3. Cross-slice consistency fixes (each red first)

| defect | test (red before the fix) | fix |
|---|---|---|
| Cancel opened from Change: **Keep it** (and Back) went to the cancel date list | `pdates.flow.test.tsx` "Keep it and Back return to Change" -> `Unable to find an element by: [data-testid="change-what"]` | WhatChanges opens `cancelFromChangePath` (`?from=change`, `flows/cancel/cancelModel.ts`); `flows/cancel/Confirm.tsx` Back + Keep it go to `ORG_PATHS.changeDate` when `from=change`, else the cancel list as before (second test pins that) |
| One name for a rule date taken off: date page said **Break this week / Take this week off / "is a break."** | `consistency.matrix.test.tsx` INT3 rows: hits `dates/DateSheet.tsx: Break this week`, `Take this week off`, `dates/index.tsx: Break this week`, `${label} is a break.`; 4 files not reading TAKE_OFF | `shared/copy.ts` `TAKE_OFF` {label "Take this date off", sub, confirm "Take it off", done "<day> is taken off"} read by WhatChanges, TakeOff, dates/index.tsx, DateSheet.tsx |
| Copy changes list: newest-first only, copyable dates mixed with disabled ones | `pdates.flow.test.tsx` "copyable first, newest first, then disabled with the reason" -> order mismatch | `changeModel.copySources`: copyable newest first, then disabled newest first (reason shown on each) |
| Go live (P-SERIES) and Move (P-DATES) on one A1 gate | `consistency.matrix.test.tsx` "follow ONE A1 gate": only `shared/a1Gate.ts` defines it; lifecycleModel, Day, WhatChanges, new/model import it | green on the merged tree (no mismatch); kept as a guard |

Already covered by the existing S8/P-DATES/P-SERIES matrices and green after the merge: status/date wording mapping, empty states, untouched save sends nothing, no copy naming an absent control.

## 4. Browser walk 390x844 (production build, route-mocked fake)

`docs/organiser-rebuild/walk-INT3/` (README lists one line per shot), spec `tests/e2e/walk-int3.spec.ts` (not in the gate): Change what for a non-next date, Sessions/line-up, venue, ticket, picture, note, Copy list + keys, Take this date off, Cancel from Change + Keep it, Pick several (2) -> confirm -> result, Change time on a class+social date. 11/11 pass. No further visible defect found. P-SERIES walk spec on the same build: 7/7.

## 5. Per-job CI table (local, this head's code; sandbox)

| job | command | exit |
|---|---|---|
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0, 0 |
| (extra) | `npm run typecheck` | 2: 97 errors = base 97; none in files this pass touched |
| architecture-guard | `chmod +x bin/*.sh`; `bin/check-integrity.sh`; `check:legacy-tables`; `check:legacy-program-rpcs`; `lint:architecture` | 0 each |
| architecture-guard | `AUDIT_STRICT=1 check:images`; image-widths (+self-test); plan-hygiene self-test; workflow-artifact-policy (+self-test); mojibake self-test + git-grep scan; prove:entry-point (+self-test) | 0 each; scan empty |
| lint | `npm run lint` | 0 (20 of 20 links) |
| unit-tests (London) | `env -u NODE_PATH npm run test:unit:offline` | 1: 9228 pass, 1 fail `tests/client/festivalClientState.test.tsx` ("no frame carrying the previous festival day"); passes alone 8/8 twice; no file in this branch's diff touches it -> load timing in the full run |
| unit-tests | `test:unit:timing` | 0 (65) |
| unit-tests | tz list, New York + Sydney | 0 / 0 (213 each) |
| unit-tests | dancer-area-isolation self-test + check | 0 / 0 |
| organiser module | `npx vitest run src/modules/organiser` | 0: 105 files, 3251 pass |
| perf-budget | 3 self-tests; `npm run build`; `check:bundle-budget`; `check:first-load-requests`; `check:chunk-cycles` | 0 each; no budget change |
| perf-budget | lighthouse, doc-weight | NOT RUN: need a preview deploy |
| e2e-smoke | `CI=true npm run test:e2e` (job env) | 0: 158 pass, 1 skip |
| workflow-lint | masking, notification (+self-test), no-preview-prefixes (+self-test) | 0 each |
| types-drift | `gen:types` | NOT RUN: needs SUPABASE_ACCESS_TOKEN |

## Verified
- Both merges clean; no conflict markers; parity matrix 66 rows, 0 todo, mutation-proven.
- The three known defects fixed red-first; the walk shows each on the production build.
- Every local CI step above, exit codes as listed.

## Not verified
- No new prod shape survey (P-DATES's read-only survey on 2026-10-17 is the basis; nothing here changes a command or a read).
- GitHub PR checks on this head not read (no `gh api`; Vercel preview not checked: no VERCEL_TOKEN in this sandbox -> needs owner: Vercel token).
- lighthouse / doc-weight / types-drift (need deploy or secrets).
- `/code-review` rounds not run (CLAUDE.md: Ricky types it); the git hooks in `.githooks/` were not executable in this checkout so pre-commit/pre-push did not run (not bypassed with --no-verify).
- Ricky's phone test.

## Decisions
1. Cancel-from-Change uses a `?from=change` query (like the existing `?put=back`), not a new route: one Confirm screen, no fork.
2. The shared words live in `shared/copy.ts` `TAKE_OFF`; the done message is "<day> is taken off" on both Change and the date page.
3. C20 and C61 stay PARTIAL (A1 gate; end-only time change undetectable). C13/C22/C52-C59 are MATCH: the date editor reaches any coming date.
4. The full-run festival flake was not "fixed": outside this PR's scope; recorded here.
