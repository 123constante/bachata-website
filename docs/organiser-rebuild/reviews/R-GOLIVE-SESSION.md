# R-GOLIVE-SESSION -- independent read-only review of PR #885

Branch `claude/org-r1-golive-session`, head `fe8e7ce7`. Base `main` `0ab0ff9`. Nothing in the PR was changed.

## Verdict: PASS WITH FIXES

The rule is right, both buttons go through one function, and every prod shape that is valid today stays enabled.
One fix: no test renders either screen. If you unwire both screens, all 3369 organiser tests stay green.

## Findings

| # | Severity | Where | Failure scenario |
|---|---|---|---|
| F1 | fix | `src/modules/organiser/flows/new/NewFlow.tsx:321`, `src/modules/organiser/events/LifecycleActions.tsx:61` | Mutation run: (a) changed NewFlow's `StepButton reason={finishReason(...)}` back to `coverStepReason(!!cover)`, and (b) changed the card's `{rows.goLive?.reason && rows.goLive.toProgramme && (` to `{false && (`. `npx vitest run src/modules/organiser` still gives 3369 passed / 2 skipped. The matrix only tests the pure functions. A later refactor could bring the zz-test bug back on the wizard, or drop the "Add a session" link, and nothing would catch it. The brief says "on BOTH screens". Needed: one RTL test that renders `LifecycleActions` for the zz-test shape and checks the `Add at least one session first.` reason and `org-life-add-session` href = `ORG_PATHS.eventProgramme(id)`. Also one test that renders the New flow cover step with a session-less draft and checks `org-new-live` is off with `NO_SESSION_NEW_REASON`. |
| N1 | nit | `src/modules/organiser/flows/new/NewFlow.tsx:19` | `coverStepReason` is still imported but no longer used (eslint does not flag it). Remove it. |
| N2 | nit | `NewFlow.tsx:32-39` (LeaveLink), `flows/new/model.ts:62` | The wizard never creates a session: `timeCommands` only upserts `default_local_start_time`. So with A1 on, the last step's "Go live" is ALWAYS off for a wizard-made event. That matches the owner decision and the reason is honest. But the reason says "add a session from the event", and "Save as draft and leave" goes to `ORG_PATHS.home`, not to the event or its programme. The person has to find the event again. Possible change: when the session is the only blocker, point the leave link at `ORG_PATHS.eventProgramme(seriesId)`. |
| N3 | nit | `src/modules/organiser/events/lifecycleModel.ts:68` | With A1 off, the reason reads `Needs the next platform update. Before then, Add at least one session first.` (capital A mid-sentence; with Details items too: `... in Details. Add at least one session first.`). `A1_APPLIED = true`, so prod never shows this. It only matters if the gate is switched back off. |
| N4 | nit | `LifecycleActions.tsx:61` -> `events/programmeSeriesModel.ts:138` | A festival draft with no session gets "Add a session". That link opens the programme screen, which is off with `Festival days are edited with the platform team for now.`. No festival drafts exist on prod, and the wizard cannot make one (NEW_FORMATS = recurring, one_off). Possible change: for `format === 'festival'`, use the team wording instead of the link. |
| N5 | nit | `flows/new/model.ts` `finishReason` + NewFlow CoverStep | If the draft fetch fails, `draft.data` stays undefined and the button shows `One moment, checking your event.` with no retry. The leave link is still on screen, so the person is not stuck. |
| N6 | nit | `lifecycleModel.ts:46-49` | `MISSING_DATE` is skipped when `default_start_date >= today` even if no scheduled occurrence row exists. In that case `hasUpcomingSession` finds no listed date, so a draft WITH a programme would be asked for a session. On prod, wizard drafts get their occurrence row (zz test has one listed date), so I did not see this. The server's A1b gate needs a scheduled date anyway. |

## Checks against the brief

1. **Rule = #681 = admin #711**: PASS. `git show 0e1cb9b5` `sessionDates()` keeps upcoming dates that are not cancelled. Programme session: every such date counts. Otherwise: dates with `added_sessions_count > 0`. `hasUpcomingSession` (`lifecycleModel.ts:28-31`) is the same filter (`occurrence_date >= today`, `!isCancelledDate`) and the same branch. `programHasSessions` needs a non-empty `start_time`, the same as prod `event_series_program_item_p5.start_time is not null`. One difference: #681 only applied the rule when `upcomingListed > 0`. The PR only applies it when `MISSING_DATE` is absent (see N6). `reviewModel.ts` is gone (S5), so there is only ONE copy of `NO_SESSION_REASON`.
2. **Shapes (prod SELECT, counts only, 2026-10-20 London)**: every one of the 67 live series has a programme item. 49 have an upcoming listed date, and the rule is true for all 49. The other 18 have no upcoming listed date (past runs) and never reach the draft Go live row. Live festivals with programme days and listed dates: 6/6 rule true. Weekly series with a programme: 28 + 7 + 1 rule true. 13 series have added sessions only on past or cancelled dates: 8 of them also have a programme and a listed date (rule true via the programme). The other 5 are live recurring with a programme but no listed date (no false block, since a draft needs a listed date anyway). Paused one_off with no programme and a listed date (zz test): rule false = blocked, which is correct. Draft one_off with no date and no session: the date is asked for first, and the session after a date exists. No valid shape is falsely blocked.
3. **One function, wording, links**: PASS. The card and the wizard both call `hasUpcomingSession`. `NO_SESSION_NEW_REASON` is built from `NO_SESSION_REASON`, not copied. `ORG_PATHS.eventProgramme` exists (`shell/paths.ts:56`, routed, tested in sw1.parity). `programmeOff` allows a draft (only festival, ended/archived, non-owner, or AW1 off block; `AW1_APPLIED = true`). A programme save goes through `useEventSend`, which invalidates `eventWorkspaceQueryKey`, so the card re-enables when the person comes back. The wizard reason names "Save as draft", and that control is on screen (see N2 for where it goes).
4. **Loading**: PASS. The card renders only with a loaded `ws`. While the draft loads, the wizard shows `CHECKING_REASON`, and `goLive()` re-checks `finishReason` before sending.
5. **New-flow data**: the draft comes from `seriesWorkspaceQueryKey` (`admin_event_workspace_p5`), which carries `program` and `occurrences[].added_sessions_count`. So a series that already has a programme is not wrongly blocked. In practice, a wizard draft never has a session (N2).
6. **Tests**: red-first PASS. Running the new matrix against `main`'s four source files gives 15 failed. Removing the rule from both pure functions gives 10 failed in the matrix. The UI-wiring mutation survives (F1).
7. **Commands on PR head `fe8e7ce7`** (all exit 0):

| Command | Result |
|---|---|
| `npx vitest run src/modules/organiser` | 119 files, 3369 passed, 2 skipped, exit 0 |
| `npm run build` | built, prerender ok, exit 0 |
| `npx eslint` on the 6 touched src files | exit 0 |
| `npm run lint:architecture` | "Runtime architecture guard passed.", exit 0 |

## Not verified

- Browser walk at 390x844 on the Vercel preview (not done; no VERCEL_TOKEN was used).
- Any real-phone test, or a live Go live press (not done; never on prod).
- Full CI job set (`npm run lint` chain, e2e smoke, integrity/`check:images`) was not run by me. Only the 4 commands above.
- GitHub check status of PR #885 (not read; no gh api).
- Server-side bypass: the server still accepts a live event with no session (owner accepted this).
