# INTEGRATE-FIX -- the one fix pass on `claude/org-r1-integrate` (F1-F4)

Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/F-INT.md` (sha a152d067). Ticket dt_f597fdf3f118. Date 2026-10-17.
Base head: 7e506a34 (INTEGRATE handover). Open PR on this branch: #809.

**Verdict: the four findings are fixed. Every gate that was red is now green, apart from the base failures.** No guard, `allowFiles` or protected file was touched.

## Done

| Finding | Fix | Files |
|---|---|---|
| F1 `no-legacy-organiser-fields` | Reworded the comment. The tests now read the organiser key from `createSeriesCommand({}, id).payload`, the one builder that attaches it (`organiserPart`, `DRAFT_KEYS`). The banned literal is not spelled anywhere. | `flows/new/model.ts:26`, `flows/new/__tests__/NewFlow.test.tsx` |
| F2 cover `<img>` | Added `loading="eager"` (it is above the fold on C24). | `flows/new/NewFlow.tsx:279` |
| F3 7 e2e specs from the retired `NewEventPage` | These were **rewritten** against the S4 flow. S4 had no e2e spec of its own, so none were deleted. See the list below. | `tests/e2e/organiser-events.spec.ts`, `tests/e2e/organiser-layout.spec.ts` |
| F4 festival `no_dates_left` (owner-default decision) | `seriesProblems` skips `no_dates_left` when `format === 'festival'`. The row is not routed anywhere else. A finished festival now reads "Live" on My events. | `jobs/homeJobs.ts:39`, new `jobs/__tests__/homeJobs.festival.test.ts` |
| Stale comment | The `NewEventPage` wording at `edit-in-place/parts.tsx:219-221` now describes the legacy redirect to `new/what`. Wording only. | `edit-in-place/parts.tsx` |

**Owner-default decision logged (F4):** a live festival with no coming scheduled date gets **no** Home row and no problem chip. The row is not routed to the editor or anywhere else. Every other format (recurring, one_off, course) keeps the `no_dates_left` row.

### F3 in detail

`organiser-events.spec.ts`: the old tests at lines 15, 64, 96 (run at 390 and 360) and 267 are replaced by these:
- **Weekly night walk.** It goes through what, name (Next off with its reason until there is a name), venue, date, time and cover. Each step sends only its own commands: a create upsert whose organiser is `ORG`; a venue upsert; a date upsert plus `set_recurrence`; then the cover step, where Go live is disabled with "Choose a photo to go live." The series stays a draft.
- **One night.** It sends no weekly rule: three upserts and nothing else.
- **Legacy link.** `/account/o/events/new` lands on `new/what`.
- **Not-approved organiser.** It sees `org-new-blocked`, gets no name field, and nothing is sent.

The old 390/360 "Create button stays put" layout specs tested the old single-page create, which no longer exists. They are retired with no one-to-one replacement. The tap-target and no-sideways-scroll specs now cover the new steps.

`organiser-layout.spec.ts`:
- The tap-target case (79-80) now measures `new/what` and `new/name`.
- The no-sideways-scroll list (174) now has `new/what` and `new/name?format=recurring`.
- The measurement roots also take the S4 shells (`org-new-what`, `org-new-name-step`), because S4 names them `org-new-*`, not `org-page-*`. This is a test-helper selector, not a guard.

The `test:e2e` list in package.json is unchanged and still correct: both spec files keep their names, and no spec file was added or removed.

## RED first (F4): the new test run against the UNFIXED `homeJobs.ts`

```
 FAIL  src/modules/organiser/jobs/__tests__/homeJobs.festival.test.ts > homeJobs: a festival with no dates left is not a Home row (F4) > festival, 0 coming, past dates true -> row false
 FAIL  src/modules/organiser/jobs/__tests__/homeJobs.festival.test.ts > homeJobs: a festival with no dates left is not a Home row (F4) > festival, 0 coming, past dates false -> row false
AssertionError: expected true to be false // Object.is equality
 FAIL  src/modules/organiser/jobs/__tests__/homeJobs.festival.test.ts > homeJobs: a festival with no dates left is not a Home row (F4) > a finished festival still shows Live on My events, not a problem chip
AssertionError: expected { label: 'Needs dates', tone: 'bad' } to deeply equal { label: 'Live', tone: 'ok' }
      Tests  3 failed | 9 passed (12)
```

After the fix, all 12 pass. The table covers format (festival, recurring, one_off, course) x coming-date count x past dates. The home payload carries no past dates, so the past-date column is proven not to change the outcome.

## Verify (local sandbox, the working tree that was committed)

| Command | Exit | Note |
|---|---|---|
| `npm run lint:architecture` | 0 | was 1 |
| `AUDIT_STRICT=1 npm run check:images` | 0 | was 1 |
| `npm run lint` | 1, then **0** | The 1 is `check:integrity` exit 126: `bin/check-integrity.sh` is mode 100644 in git (on main and the base too), so the sandbox cannot exec it. `bash bin/check-integrity.sh` gives 0. With a local, uncommitted `chmod +x`, the lint chain gives **18 of 18 links green, exit 0**. |
| `npm run typecheck` | 2 | 96 errors, the same as base. No new errors. |
| `npx vitest run src/modules/organiser` | 0 | 98 files, 3233 tests passed |
| `npx playwright test organiser-events organiser-layout` | 1 | 21 of 22 pass. The one failure is the base `organiser-events` schedule-card spec (now at line 199). |
| `npm run build` | 0 | |
| `npm run test:e2e` (full) | 1 | 140 passed, 6 failed, 1 skipped. See the breakdown below. |

**The e2e count, against the target:**
- Before: 137 pass / 10 fail.
- Now, in the full run: 140 pass / 6 fail.
- Three of the 6 are the base failures named in the brief: `organiser-loop`, the `organiser-events` schedule card and `dancer-app/home-nights`.
- The other three were `auth-magic-link-returnto:88` and `dancer-home:93` and `:168`. All three are outside this diff. They passed in the INTEGRATE run, and re-run alone they pass (`auth-magic-link-returnto` + `dancer-home`: 16/16, exit 0). They are timing flakes under load: this full run took 10.0m against 7.4m before.
- A cold first load of the new lazy `flows/new` chunk on the dev server also failed the new specs once; they pass on every run after that. CI may see the same cold-compile flake. Watch for it.

## Verified / Not verified

**Verified:**
- All the fixes above.
- The F4 RED-then-green evidence.
- Every red-or-touched gate, with the exit codes shown.
- The new e2e specs pass against the `organiserFake`.
- The production build.

**Not verified:**
- GitHub check runs on the pushed head. They had not finished when this was written.
- `check:doc-weight`, `check:lighthouse` and `check:og` (they need a preview deploy).
- The live-DB `*.contract.test.ts` (no secrets here).
- The cover upload and Go live in e2e: the fake has no storage upload, so the walk stops at the cover step.
- No real-phone walk.
- No prod re-count of finished festivals. INTEGRATE counted 1 on 2026-10-17, and this pass did not re-query.
- `tests/e2e/organiser-launch-walk.spec.ts:195,481` still drives the retired `org-new-event-*` testids. It is NOT in the `test:e2e` list and not in the brief's scope, but it will fail if anyone runs it. It needs the same rewrite as F3.

## Next steps

1. Owner: review PR #809. Re-check its CI once it lands. If the cold-chunk e2e flake shows, a warm-up visit in the spec is the fix.
2. Rewrite `organiser-launch-walk.spec.ts` (195, 481) against `new/what` in a later slice.
3. Optionally commit `bin/check-integrity.sh` as 100755. It is a `bin/` script, so it is a guard-adjacent change and needs the owner's approval.
