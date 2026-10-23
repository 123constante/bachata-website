# ER-FIX-C3: wave 1 review fix pass, slice C3 (PR 903)

Branch `claude/er-s1-rules`. Ticket dt_2ff18fd95f26. Brief `docs/organiser-rebuild/briefs/ER-FIX-W1.md` (sha 2984b1b), Section C3. Findings: `ER-W1.md` on `claude/review-er-wave1`. Server NOT landed (AD1 / admin PR 907 not applied to prod): every server reply here is faked in tests. Do not add automerge-ok; this arc merges nothing.

## Per finding

| # | Verdict | What changed | Red first |
|---|---|---|---|
| C3-1 | FIXED | `selfServeErrors.isSeriesNotFound` (anchored `^series_not_found\b`); `resolveSeries` maps it to `gone` (access refusals still `no-access`). `WhichDay.tsx` / `Time.tsx` show `Failed` only for `home.isError`, `lookup.state === 'error'` or a workspace error on a FOUND series, so a refused lookup now renders "Event not found" with Back to Home, not "Did not load". | YES: the hook test and both screen tests use the real reply `{ code: 'P0001', message: 'series_not_found: <id>' }`. 3 failed on the unfixed code (`error` instead of `gone`; no "Event not found" on Which day or on Time). |
| C3-2 | FIXED | `RuleSeries.status` (null = not created yet, treated as draft). `dateInPast` only for `preLiveStatuses` = draft, rejected, pending_review (JSON). JSON fixture "live weekly with a past first date" is ready. | YES (4 rows red: live, paused and ended got `dateInPast`). |
| C3-3 | FIXED | Blocker `flyer` ("Flyer needed", `RuleSeries.flyer`) and festival-only `festivalDay` ("Session each day", `RuleSeries.programmeDays?`). The JSON `serverCodes` maps flyer to `no_flyer`/`cover` and festivalDay/date/session to `no_session_first_date`. Description is NOT a client blocker: `readiness().serverOnlyBlockers = ['description']`. Parked for the owner. | YES (3 rows red). |
| C3-4 | FIXED | JSON `ownerCreateFormats: ["one_off","recurring"]`, `ownerCanCreate(format)`; `formats` is unchanged. **The admin copy of event-rules.json needs the same change (ER-C13 carries it).** | YES (8 rows red: not a function or key missing). |
| C3-5 | FIXED (judgement parked) | The rollover hour stays 08:00 and a test pins it equal to `lib/programDayRollover` `ROLLOVER_HOUR`. HH:MM carries no date, so the admin date rule is applied on one night: a session before 08:00 rolls to the night before only when the day has a session starting from `time.eveningFrom` 18:00. JSON fixture "daytime programme does not roll". | YES (07:30-09:00 + 10:00-12:00 gave 10:00 / 09:00). |
| C3-6 | FIXED | `maxSessionMinutes` = programmeModel `LIMITS.sessionMaxMinutes` (720), exported for C4. `validSessionPair(start, end, cap = maxSessionMinutes)` refuses longer pairs, so 20:00-19:59 is now invalid. **Deviation, on real data:** prod holds 7 LIVE festival sessions over 12 h (10:00-07:00 and others) that the server allows. So readiness applies the cap only before go-live (preLiveStatuses), and a live series is never turned Not ready by it (rule 28). Parked. Note: the brief names `events/programmeModel.ts`, but the file is `shared/programmeModel.ts`. | YES (4 rows red). |
| C3-7 | FIXED | Own-property check via `Object.prototype.hasOwnProperty.call`. `Object.hasOwn` is not in the app's `lib: ES2020`, and the behaviour is the same. `formatPaymentMethods` now drops repeats and unknown codes. | YES (6 rows red: `constructor`, `toString`, `__proto__`, `hasOwnProperty`, `door,door`, inherited name taken as a payment). |
| C3-8 | FIXED | A given `--admin` (also a bare one, or one followed by a flag) whose file is missing exits 2 (`admin-asked-absent`). Both copies are compared after CRLF -> LF. With no path at all it still SKIPS loudly (exit 0). Self-test covers: CRLF vs LF identical, a CRLF copy that differs, asked+absent, asked+no value, and main() for typo / bare / flag-next. Also added to `prove-entry-point-dispatch.mjs` TARGETS: `prove:entry-point` exited 2 on the original PR head because the new script was missing there. | YES: the old script gave exit 0 for both `--admin nope.json` and a bare `--admin`. |
| C3-9 | NOTE | `VITE_ORGANISER_REBUILD` is a build-time env. Set it in the Vercel **Production** scope on purpose; if it is set for "All environments", previews and prod share one allowlist. Nothing reads the switch yet. | n/a |

None disagreed outright. C3-5 and C3-6 are fixed with the deviations stated above, and both are parked (`parked/ER-C3.md`).

Public exports: ADDED only, none renamed. List in `ER-C3.md` under "ADDED by ER-FIX-C3". `validSessionPair` gained an optional third argument.

## CI jobs run in the sandbox (final tree)

| Job | Command | Exit | Note |
|---|---|---|---|
| architecture-guard | `node scripts/ci/docs-only.mjs` | 0 | docs_only=false |
| architecture-guard | `bash bin/check-integrity.sh` | 0 | 2045 files, 0 issues |
| architecture-guard | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0 | |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images` | 0 | |
| architecture-guard | image-widths, plan-hygiene, workflow-artifact-policy, mojibake (self-tests + guards) | 0 | |
| architecture-guard | `npm run prove:entry-point:self-test` / `npm run prove:entry-point` | 0 / 0 | was 2 before the TARGETS row (see C3-8) |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | 0 | `tsc -p tsconfig.app.json`: no errors in touched files (the repo has older errors elsewhere; not a gate) |
| workflow-lint | BOM, docs-only self-test, workflow masking / notification, no-preview-prefixes | 0 | |
| unit-tests | `npm run test:unit` | 1 | 15 failed, all from the sandbox: 10 `*.contract.test.ts` failed with "Invalid API key" (no real secrets here), 5 `tests/integrityCouldNotRun.test.ts` failed because of the sandbox NODE_PATH (67/67 pass with `env -u NODE_PATH`). None are in changed files. Organiser suite: 3470 passed |
| unit-tests | `test:unit:timing`; tz files under New York and Sydney; dancer-area-isolation | 0 | |
| perf-budget | 3 canaries, `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | 0 | |
| e2e-smoke | `npm run test:e2e` (CI env) | 0 | 159 passed, 1 skipped, 1 flaky that passed on retry (`dancer-home.spec.ts:168`, not touched) |
| phone-qa | `playwright.phone.config.ts`; build-smoke | 0 / 0 | 272 passed, 74 skipped; 66 passed |
| db-contract-check | live-db gate + self-test, migration-stamps, guest-list canary, day-rollover, script-conventions | 0 | about 45 live `check-*.mjs` steps NOT RUN: they need repo secrets and the live DB |
| lint (local chain) | `npm run lint` | 1 | only the `check:integrity` link failed, with exit 126: the sandbox checkout has `bin/*.sh` without the executable bit, and CI runs `chmod +x` first. With `bash bin/check-integrity.sh` it exits 0. The other 19 links PASS. eslint on the changed files: 0 errors |
| phone-qa-section / real-data-verified | PR-body checks | n/a | the PR body needs the two sections below, copied in (the bot opens the PR) |
| mirror | `node scripts/check-event-rules-mirror.mjs --self-test` | 0 | |

Not run: lighthouse and doc-weight (skipped for `claude/*`), og/seo (need a preview), Docker, a real phone.

## Verified on real data

**Shapes surveyed** (read-only SELECT on prod `stsdtacfauprzrdebmzg`, counts only, 2026-10-21):
- `event_series_p5` by status x format: live 67 (recurring 44, course 6, one_off 10, festival 7), ended 21, paused 2, draft 2, archived 653.
- First date in the past: live recurring 43/44, live course 6/6, live one_off 8/10, live festival 0/7. Before the fix every one of these would read "Not ready" (C3-2); now they are ready.
- No cover: 0 live, 1 draft. No description: 0 live, 2 drafts, 1 paused.
- `event_series_program_item_p5`: 662 items, 223 untimed, 78 ending the next day, 1 starting before 08:00 (live festival 07:00-09:00), 7 over 720 min (all live festivals, e.g. 10:00-07:00, 10:30-23:00). This set the C3-6 decision: the cap is applied before go-live only.

**Checks run:** the table-driven tests in `eventRules.fix.test.ts` cover every status (live, paused, ended, draft, rejected, pending_review) x past first date, the flyer and festival-day shapes, an over-12 h live festival, owner create formats, rollover and the payment strings. The hook and screen tests use the real `series_not_found` reply. The JSON fixtures were extended (live weekly with a past date; no flyer; daytime programme).

**NOT verified:** end-to-end against the real server (AD1 not landed). The `series_not_found` text comes from the reviewer's `pg_get_functiondef` read; I did not re-read it in this session. The admin copy of event-rules.json is not compared (no access to the admin repo; ER-C13 carries the JSON change). No real phone.

## Phone QA

**Sizes checked:** 390x844 (Playwright, Chromium, the dev server with `VITE_ENABLE_ORGANISER_SELF_SERVE=true`, and the stateful `tests/e2e/helpers/organiserFake.ts` with the workspace read overridden to the real refusal shapes). The throwaway spec was deleted after the run, so it is not in the diff.

**Walked** (7/7 passed):

| Screen | URL | State | Shows |
|---|---|---|---|
| Which day | `/account/o/add/<unknown id>` | P0001 `series_not_found: <id>` | "Event not found" + Back to Home (no "Did not load", no Try again) |
| Time | `/account/o/add/<unknown id>/2026-10-16` | same | same |
| Which day / Time | `/account/o/add/<id>` | `permission_denied: ...` | "You don't have access to this event" |
| Which day / Time | `/account/o/add/<id>` | workspace says archived | "This event was archived" |
| Which day | own live series | found | the day list |

On each not-found screen: Back to Home is at least 44px tall, there is no horizontal scroll, and the header reads "Back" / step title. Screenshots are in the sandbox only, not committed.

**Not verified:** a real phone, iOS Safari, and prod data on these screens (no prod login in the sandbox; the ids above are fake).

## Next steps
- Owner: decide description (server requires it, plan says optional). Set `VITE_ORGANISER_REBUILD` in Production scope only.
- ER-C13: copy `event-rules.json` (now with `ownerCreateFormats`, `preLiveStatuses`, `serverCodes`, `serverOnlyBlockers`, `time.eveningFrom`, blockers `flyer` / `festivalDay`) to admin byte-for-byte; wire the mirror script with `--admin` in a workflow (needs owner: workflow step + admin checkout token).
- C4: read `maxSessionMinutes` from `shared/eventRules.ts`.
