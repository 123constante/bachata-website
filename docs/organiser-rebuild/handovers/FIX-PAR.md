# FIX-PAR -- one fix pass on PR #809 from REVIEW-PAR-A and REVIEW-PAR-B

- Ticket dt_3d1e66842a49, brief `F-PAR-fix.md` (sha 203d4886). Branch `claude/org-r1-integrate` from 5369379.
- Commits: 7b01354 (checkpoint: Change-flow items, `[skip preview]`), then the final commit (events / P-SERIES items, this doc, walk screenshots).
- Method: every item got a test first. Each test was run against the UNFIXED code and went red (excerpts below), then the fix went in and the test went green.
- No migration. No write to prod. Not touched: the density-exempt calendar files, `ui/dialog.tsx`, `shared/editorGuards.ts`, `shared/seriesModel.ts`.

## Status

**Done:** every BLOCKING, SHOULD and NOTE item in the brief, except those listed under Queued.

**Left:** nothing in this brief's scope. See Queued, and Not verified.

**Next steps:**
1. Rerun review on the new head.
2. The owner phone test.
3. The admin defect under Queued (admin repo).

## Decisions (orchestrator's, as applied; the owner can overrule)

1. **PAR-A B1.** `endBoxShown(sessions)` in `changeModel.ts` decides whether Change time offers the end box.
   - With 2+ sessions, it offers the box only when the server's end target is exactly one session and that session is the night-last one. The server's target is the plain-clock `max(eff_end)`, via `serverEndTargets`.
   - Otherwise Change time shows `END_GUARD` ("To change when the night ends, change one session's time.") and an "Open Sessions" link to `dateLineup`.
   - Two sessions that end at the same time also get the guard, because the server would give the typed end to both.
   - The two model tests that pinned the night clock now pin the guard. A table-driven test covers: class+party (guard), two daytime sessions (box), one session (box), party + after-party ending 04:00 (box), and two sessions ending together (guard).
2. **PAR-B B1.** One constant, `GO_LIVE_READY` in `lifecycleModel`: "Your event is ready. Go live switches on here after the next platform update." Go live stays disabled while `A1_APPLIED=false`.
3. **PAR-B S8.** Pick several now has an Earlier / Later choice plus an unsigned number of days (1-60, `inputMode="numeric"`). The command sends the signed `shift_days`.
4. **PAR-A S3.** The half-done line reads `"<keys> copied, <rest> not copied: <reason>"` (`copyHalfDone`). `sendAll` takes an optional `partial` callback.
5. **PAR-B S4 / N4.** `NO_COMING` ("No coming dates, so nothing repeats. Add a date first.") lives in `shared/copy.ts`.
   - Stop repeating with 0 coming dates is shown off with that reason and an Add a date link: on the One event row, and on `?do=stop`.
   - Pick several with 0 coming dates shows the same sentence and an Add a date button.
6. "Ask the Bachata Calendar team." is kept as it is.
7. PAR-A N1: the reachability check now strips comments (`codeOnly`). PAR-B N5 was cheap, so it is done.

## Queued (not fixed here)

- **ADMIN DEFECT (admin repo).** `_cmd_occurrence_set_time_p5` picks the session that gets the typed end with a plain-`time` `max(eff_end)`, ignoring midnight.
  - On a class 20:00-21:00 + party 21:00-02:00 night, the typed end goes to the class.
  - 241 coming dates on prod are affected (REVIEW-PAR-A count, 2026-10-17).
  - Fix there with the night clock: the 08:00 rollover, the same rule as `programDayRollover`. The screen's guard (decision 1) can go once it lands.
- **PAR-A N2 (latent).** Change time is not refused for a festival, so the server's `invalid_payload: per-date time is not supported for festivals` shows as the generic line. The festival reach count was not taken.
- **Pick several "collide".** There is no client pre-check, because the server also counts cancelled dates, which the client list does not hold. The server refusal now has a plain reason (PAR-A S1 row).

## Red-first table

| item | test (file > name) | red on the unfixed code | green |
|---|---|---|---|
| PAR-A B1 (dec. 1) | pdates.model > end box table x5, guard text; pdates.flow > `class 20:00-21:00 + party 21:00-02:00: end box false` | `endBoxShown is not a function`; flow: `expected true to be false` (end box rendered) | yes |
| PAR-B B1 | fpar.review > `GO_LIVE_READY is the one ready sentence` + 9 reason rows | `expected undefined to be 'Your event is ready...'`; nothing missing gave `'Needs the next platform update.'` | yes |
| PAR-B S7 | fpar.review > date row / `org-life-add-date` link | `...add a date from today on in Details.`; `Unable to find [data-testid="org-life-add-date"]` | yes |
| PAR-A S1 | pdates.model > 3 COMMAND_COPY rows + `shiftPastProblem` x5; pdates.flow > past refusal, collision reason | `expected 'Something went wrong. Please try again.' not to be ...`; `shiftPastProblem is not a function`; `Unable to find change-pick-earlier` | yes |
| PAR-A S2 | fpar.review > `Stop repeating line` x4 (none / some / all curated / cut at last) | `TypeError: stop is not a function` (line not counting curated) | yes |
| PAR-A S3 | pdates.model > `copyHalfDone`; pdates.flow > `the second set_override is refused` | `copyHalfDone is not a function`; flow showed only `Enter a full link starting with https://.` | yes |
| PAR-B S1 | pdates.flow > `an end before the start keeps the old end in the preview` | `expected '...17:00-16:30' not to contain '16:30'` | yes |
| PAR-B S2 | pdates.model > words; pdates.flow > 3 delta tests | `expected 'Every session moves by 1 h later' to be 'Every session moves 1 h later'` | yes |
| PAR-B S3 | pdates.flow > `one session gets a now -> new preview ... "Night starts"`, `plain label` | `Unable to find [data-testid="change-time-start-label"]` | yes |
| PAR-B S4 | fpar.review > eventActions NO_COMING; One event row; `?do=stop` | `expected { reason: null } to deeply equal { reason: NO_COMING }`; `expected null to be 'true'` | yes |
| PAR-B S5 | fpar.review > DatesTakenOff button; fpar.datesheet > uncancel button | `expected 'Put back' to be 'Put it back'`; `expected 'Put it back on' to be 'Put it back'` | yes |
| PAR-B S6 | pdates.flow > `shows TAKE_OFF.body and where to put it back`; fpar.datesheet > S6 | `expected '...It disappears from the calendar...' to contain 'It comes off the calendar...'` | yes |
| S5/S6 matrix | fpar.copy.matrix (4 old-string rows) | 3 red: `>Put back<` (DatesTakenOff.tsx), `Put it back on<` and `for a break` (DateSheet.tsx) | yes |
| PAR-B S8 | pdates.flow > `Earlier / Later plus an unsigned number of days` | `Unable to find [data-testid="change-pick-earlier"]` | yes |
| PAR-B S9 | fpar.review > Prices add then Save / blur; Ends typing then blur | `role="alert"` present right after Add a price; reason shown 2 times; Ends alert while typing | yes |
| PAR-A N1 | parity-matrix > `codeOnly:` x8 incl. the in-memory M2b mutant (Pick line -> `{/* ORG_PATHS.changePick */}`) | `ReferenceError: codeOnly is not defined`; the raw text check passed the mutant | yes |
| PAR-B N1 | fpar.datesheet > `the line-up section is headed "Sessions"` | `expected 'Schedule' to be 'Sessions'` | yes |
| PAR-B N2 | pdates.flow > `the reset button and its done line use one label` | `expected 'Back to usual time (20:00)' to match /^Back to the usual time/` | yes |
| PAR-B N3 | pdates.flow > `nothing to copy reads "Nothing to copy"` | `expected 'Copy 0 changes' to be 'Nothing to copy'` | yes |
| PAR-B N4 | pdates.flow > `no coming dates says so and links to Add a date` | `expected 'No coming dates to pick. Add a date first.' to be NO_COMING` | yes |
| PAR-B N5 | fpar.review > `?do=weekly` on weekly / `?do=stop` on one-off | `expected 'This event cannot do that now.' to be 'It already repeats weekly.'` | yes |
| PAR-B N6 | fpar.review > event name on its own line | `Unable to find [data-testid="event-step-name"]` | yes |
| PAR-B N7 | fpar.review > `a one-week choice says "1 week"` | choice read `1 weeks, until Wednesday 21 October` | yes |
| PAR-B N8 | `npm run check:mojibake` + non-ASCII grep of `seriesExtras.ts` | check exit 0 before too (it does not flag raw pound/euro); grep found 1 line | 0 non-ASCII lines |
| PAR-B N9 | pdates.flow > live region mounted, no aria-label, describedby hint; fpar.review > Off rows focusable + described; Discard destructive | `Unable to find change-time-live`; `expected null to be '0'` (tabindex); no `bg-[var(--danger)]` | yes |

## CI per job (sandbox, final tree)

| job | command | exit |
|---|---|---|
| typecheck | `npm run check:rpc-typing`; `npm run check:wallclock-brand` | 0; 0 |
| unit-tests | `TZ=Europe/London env -u NODE_PATH npm run test:unit:offline` | 0 (394 files, 9297 pass, 28 skip) |
| unit-tests (organiser) | `npx vitest run src/modules/organiser` | 0 (108 files, 3329 pass, 2 skip) |
| lint chain (integrity, legacy-tables, legacy-program-rpcs, lint:architecture, mojibake ...) | `npm run lint` (after `chmod +x bin/*.sh .claude/hooks/*.sh` as CI does; reverted, not committed) | 0 (20 of 20 links; eslint informational) |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images`; `npm run check:mojibake` | 0; 0 |
| perf-budget | `npm run build` with the workflow's placeholder env; `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles`, `check:bundle-budget:self-test` | 0 each |
| e2e-smoke | `CI=true npm run test:e2e` | 0 (158 pass, 1 skip, 7.0 m) |
| lighthouse, doc-weight, types-drift, live DB contract suites | -- | NOT RUN: they need a deploy or secrets |

Notes:
- A build with `VITE_ENABLE_ORGANISER_SELF_SERVE=true` and no Supabase env fails `check:bundle-budget`: `vendor-supabase` is in the first load. The CI-equivalent build passes. That is an env difference, not this diff.
- The unit run rewrites `tests/regression/today/__snapshots__` (date-based). They were reverted, not committed.

## Walk (390x844, production build, route-mocked fake)

- Setup: `VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build`, served with `scripts/_serve-build.mjs`. The throwaway spec `tests/e2e/walk-fixpar.spec.ts` is not committed and is not in the gate.
- Result: 5 of 5 pass, and `scrollWidth` is at most 390 on every screen.
- Screenshots in `docs/organiser-rebuild/walk-FIXPAR/`:
  - **Change time, class 20:00-21:00 + Late Party 21:00-02:00** (`time-class-party-*`): no end box. The guard sentence and Open Sessions show. Moving to 21:00 gives "Every session moves 1 h later" and both rows preview.
  - **Change time, one session 20:00-01:00** (`time-one-session-*`): the end box shows, and "Now 20:00-01:00 -> new 21:00-02:00" previews.
  - **Change time, two daytime sessions** (`time-two-daytime-*`): the end box shows, labelled "End of Turns".
  - **Pick several** (`pick-*`): Earlier / Later chips. Earlier 5 days on the first date is refused with `PICK_PAST`, which the test asserts as visible. The full-page shot clips the lower part, because the page scrolls inside its shell.
  - **0 coming dates** (`zero-*`): `?do=stop`, the One event row and Pick several each show `NO_COMING` and an Add a date link.

## Verified

- Every item above: red on the unfixed code, then green.
- All the CI job steps in the table.
- The 390x844 walk of the brief's three Change time shapes, Pick several, and the 0-coming-dates series, on the production build.

## Not verified

- **Real data:** no set_time write on a real date. The B1 guard follows REVIEW-PAR-A's reading of the prod function body. I made no new prod SELECT in this pass; the shapes come from the two reviews' surveys (2026-10-17).
- **Devices:** no real phone, no real iOS number pad (S8), no screen reader.
- **CI on GitHub:** lighthouse, doc-weight, types-drift and the live contract suites were not run. The GitHub PR checks on the new head were not read (no `gh api`).
- **Vercel:** no `VERCEL_TOKEN` was used, so the preview was not checked. Needs owner: Vercel token.
