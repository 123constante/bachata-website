# Review: PR #1122, P3 W3c-1 Repeat sheet (read-only review, one pass)

Reviewer: Fable (ticket dt_a77321ed993b). Reviewed head `9396d66b37ede23bddc9c3dd36fb4404fe648a9f` of `claude/w3c-1-repeat` against `main` (`43b3419`). Brief: `brief/w3c-1-repeat-review:docs/briefs/w3c-1-repeat-review.md`. No product code changed by this review.

## Verdict: FIX FIRST

The save path is sound: the payload the sheet builds matches the live owner rule key for key, weekday numbering agrees with Postgres (0 = Sunday), the 24-month bound uses the same month-end clamp, an untouched sheet sends nothing, stale dry-run answers are never shown, and Save is off while a dry run is pending. Two things block: the `real-data-verified` check is red because two PR-body labels are not in the form the parser reads, and Save is ENABLED after a dry run FAILS (proven below), which lets a person save without ever seeing the red "This removes N dates" line that the screen exists to show. Four should-fix items follow, the largest being a dispatcher refusal that reaches the sheet as copy pointing at a "first date" control the sheet does not have.

## Findings (ranked)

### BLOCK

**1. `real-data-verified` is red: two label lines do not parse.** `scripts/check-pr-real-data-verified.mjs` lines 58-61 read a label only as `- <label>:` (optional bold, then the colon). The PR body has `- Shapes surveyed (read-only, counts, prod ...):` and `- Checks run (matrix tests, every CI job step, browser walk at 390x844):`, so both read as missing (job 123147698142: "Shapes surveyed: line is missing", the required format printed). `phone-qa-section` passed on the latest body (job 123147698464); leave that section as it is. The exact lines are in the last section of this file.

**2. Save is enabled after a FAILED dry run.** `src/modules/organiser/p3/screens/RepeatSheet.tsx:165-173`: `shown` is the error answer, so `checking` is false, `problem` is null, and `saveButton` returns enabled. Proven with a throwaway component test through the real `EventPage -> RepeatSheet -> series_command_p5` path (not committed): weekly series, tap Monday, the dry run answers `permission_denied: series.set_recurrence ...` -> preview error shown, **Save disabled = false**, label "Save the new pattern"; the same with the rpc throwing `TypeError('Failed to fetch')` (phone offline) -> **Save disabled = false**. Concrete failure input: a weekly Friday series with 12 dates; the person taps Monday, unticks Friday, the phone drops the dry run; Save is enabled with no "This removes 12 dates already on the calendar" line; one tap removes every Friday. The server still spares curated dates and cancels booked ones, so the loss is bounded, but the preview is the only warning and it was skipped. Fix (one line plus a test): treat an error answer as "not shown" for the button, e.g. `problem: problem ?? (checking ? REPEAT_COPY.checking : shown?.state === 'error' ? REPEAT_COPY.retry : null)`, so Save waits for a good answer and "Check again" is the way on; add the two probe cases to `repeat.send.test.tsx` (RED first against the unfixed sheet: both fail today).

### SHOULD-FIX

**3. Two dispatcher refusals reach the sheet with the wrong sentence, pointing at a missing control.** `apply_aggregate_write_p5` (read on prod) refuses an owner's `series.set_recurrence` with (a) `end.date must not be before the start date` when `until` is before `COALESCE(default_start_date, created_at)`, and (b) `end.date needs a start date no earlier than 12 months ago` when that anchor is older than 12 months. Both run for a dry run too, so they land in the preview. `repeatFailure` has no sentence for either and falls to `commandErrorMessage`, where `src/modules/organiser/shared/selfServeErrors.ts:254` matches `^permission_denied: series\.set_recurrence` with the pre-A2 copy: "The weekly pattern could not be saved. Pick one weekday and a first date from today on." (probe output). "One weekday" contradicts the sheet (1 to 7 days) and "first date" is the control the handover says is not built. Reach on prod today (read-only counts, 2026-10-28): (a) 7 of 8 recurring drafts have a future anchor, so "Stops on a date" before the first date hits it; (b) 0 of 44 live series have an anchor older than 12 months today, but every live series ages into it (a series created 2025-11 hits it from 2026-12 for any until_date). Fix: two sentences in `REPEAT_FAIL` matched in `repeatFailure` before the shared copy ("Pick a last date on or after the first date." / "This event started more than a year ago, so a last date can't be set here. Choose Stops after a number of times, or ask the Bachata Calendar team."), and pre-check (a) in `repeatProblem` when the workspace carries the anchor. Line 254 stays for the R1 one-weekday screen.

**4. A dropped dry run shows the save-offline sentence.** `RepeatSheet.tsx:156` sends a preview failure through `repeatFailure`, which ends in `OFFLINE_SAVE_MESSAGE`: "Your phone seems to be offline, so this may not have saved. Check your connection, then look at the date or event to see if your change is there before you save again." (probe output). A dry run saves nothing; this sends the person off to check for a change that cannot exist. The preview needs its own offline line ("...so the dates could not be checked. Check your connection, then tap Check again.").

**5. 26 unrelated screenshots re-committed.** Commit `9396d66` rewrote every PNG under `docs/handover/dancer-rebuild-w2a`, `-w2b`, `-w2d`, `-w2e` (26 binaries, about 0.5 MB of churn; `nights-*.png` in w2b all became the same 40,637-byte file), a by-product of running the full e2e suite. None is W3c-1. Fix: `git checkout origin/main -- docs/handover/dancer-rebuild-w2a docs/handover/dancer-rebuild-w2b docs/handover/dancer-rebuild-w2d docs/handover/dancer-rebuild-w2e`, commit.

**6. Save after a dropped connection is a second envelope.** `EventPage.tsx:179-180,230`: the sheet saves through `send` (`toast.run`), not `useSendOnce`, so a retry after a save whose connection dropped sends a new idempotency key against the same version. The server's version check stops a double write, but when the first one landed the person's own retry is answered "Someone changed this first. Check it." The Status sheet uses `sendOnce` for exactly this. Small: route the one-command plan through `sendOnce` with a key from `draftSig`.

### NIT

**7.** `RepeatSheet.tsx:167-173,244`: on a course the greyed editor's button reads "Nothing changed yet" (the `lock` label), which implies something could change; the why paragraph already says what to do, so the button could read "Can't change here" or be hidden in disabled mode.

**8.** `tests/e2e/walk-w3c-1-repeat.spec.ts:26-53`: Part 1 is a hand-mirrored copy of the sheet's markup, so a class renamed in `RepeatSheet.tsx` is not caught by the gate; the real sheet's geometry is asserted only in Part 2, which CI skips (flag off). Same pattern as `p3-toast-geometry.spec.ts`, and the PR body says so; recorded as the drift risk it is.

**9.** `model/repeat.ts:60`: `course_needs_count` is matched anywhere in the message (`/(course_needs_count)/`), unlike the four anchored codes. Harmless today; anchor it as `invalid_transition: course_needs_count` to match `_command_failure_code_p5`.

**10.** `contract-check` is red on the PR, but not from this PR: `check-event-truth-v1` reports 2 `course_without_length` baseline entries that no longer offend and asks for them to be removed from `event-truth-baseline.json` (live-DB drift; the same on `main`). Separate docs/baseline PR, not W3c-1.

## Verified / Not verified

**Verified (read on prod, read-only; tests run in this sandbox):**
- `_cmd_series_set_recurrence_p5`, `_owner_rule_problem_p5`, `_validate_recurrence_payload_v1`, `_command_failure_code_p5` and the two `set_recurrence` gates in `apply_aggregate_write_p5` read on project `stsdtacfauprzrdebmzg`. The owner rule's key set is exactly `mode, interval, weekdays | monthly, end, dry_run`; `rulePayload` sends no other key, always sends `interval` as an integer 1..4 (matches the textual `^[1-4]$`), weekdays sorted and distinct 0..6, `nths` distinct in `[1,2,3,4,-1]`, `count` 1..500, `until` in `[today, today + 24 months]` with the same month-end clamp as `date + interval '24 months'` (2026-02-28 -> 2028-02-28; 2028-02-29 + 12 -> 2029-02-28). `dry_run` is stripped by the handler before validation and never stored.
- Weekday numbering: server `extract(dow)` (0 = Sunday); client `getUTCDay`, `WEEKDAY_NAMES[0] = 'Sunday'`. Today: client `londonTodayKey`, owner rule `Europe/London`; the handler's `v_today` is the series timezone (UK series: the same).
- Untouched save sends nothing (matrix 198/198 here; `draftSig` normalises a stored weekly rule with no `interval` key, unsorted or duplicate weekdays, and `nths` in any order). An untouched sheet sends no preview either (send test 11/11 here).
- Dry-run race: `seq` plus `key` guard; an answer for an older draft is dropped; Save disabled while `checking`.
- `repeatAccess` versus the server: non-recurring refused server-side -> client course disabled, one-off and festival none; ended -> readonly; custom / `weekday_except_last` -> `mode_not_allowed` server-side -> client readonly. Archived and in-review are client-only (stricter, fine). The course reason names "Coming up" and "add a date", both on the event page (`addDateWhy` allows adding on a course).
- Failure codes: the four `invalid_recurrence_payload` codes and `course_needs_count` each map to one sentence (tests); version conflict -> "Someone changed this first. Check it."
- Zero bytes to `/app`: `RepeatSheet.tsx` and `model/repeat.ts` are imported only by `EventPage.tsx` (P3 area, lazy chunk mounted only when `flags.organiserP3` is on, `AnimatedRoutes.tsx:50,264`); `bundle-budget` green on the PR; `eventModel.ts` diff is two parsed fields, additive. Flag off: no route exists, so no visible change.
- Overlay: `createPortal` to `document.body` inside `p3-theme p3-portal`; `Sheet` focuses with `preventScroll`; walk Part 1 asserts sheet, Save and toast boxes inside 390x844, taps >= 44 px, contrast >= 4.5, on the real `p3.css` at html 13.5 px.
- RED FIRST: commit `a999db9` carried the model with `repeatAccess` returning a constant, `repeatPlan` ignoring access and base, and `repeatFailure` unmapped (a mutant of the three named behaviours, not an empty stub); the claim holds for those three.
- Finding 2 proven by a throwaway test (not committed) against the branch's real component; findings 3 and 4 are its printed copy.

**Not verified:**
- No dry run or save sent to prod. No local rebuild (`check:bundle-budget` taken from CI). `day_of_month` 31 in a 30-day month (skip or clamp is the compute function's; the preview would show it). No real phone; walk Part 2 (flag on) not run here; CI `e2e-smoke` and `phone-qa` were still in progress at writing.

## Checks on head 9396d66 (at writing)

| Job | Result |
|---|---|
| unit (Europe/London full, Sydney, New York), dancer-area-isolation | green |
| build-smoke, bundle-budget, integrity, wallclock-brand, masking-check, bom-check, notification-check, live-db-gate | green |
| phone-qa-section (latest body) | green |
| real-data-verified | RED (finding 1) |
| contract-check | RED (finding 10, not this PR) |
| e2e-smoke, phone-qa | in progress |

## The exact PR-body lines `real-data-verified` needs

Keep the `## Verified on real data` heading. Replace the two label lines with these (the parenthetical moves after the colon; the rest of each bullet's content can follow on the same line or the indented lines below it):

```
- Shapes surveyed: read-only counts, prod event_series_p5, re-run 2026-10-28, listed below
- Checks run: matrix tests, every CI job step and a browser walk at 390x844, table below
- NOT verified: no dry run or save was sent to prod (Supabase read-only); walk Part 2 skipped in CI (P3 flag off); no real phone; no leave guard on close; "First date" not built; the shared Toast is not portalled
```

`phone-qa-section` already passes with the present `## Phone QA` block (`- Sizes checked: 390x844 ...`, `- Walked: ...`, `- Not verified: ...`); do not change it.
