# Session handover: P3 W2b "Dates" (2026-10-27) -- PARTIAL

Branch `claude/p3-w2b-dates` (from `main` 143f9cc), PR #1062 (open, bot-authored). Brief: `brief/p3-w2b-dates:docs/briefs/p3-w2b-dates.md`.
Stopped at the owner context gate (30%), before the browser walk and the design record.

## Done (pushed)

- `p3/model/dates.ts`: ONE rule set, `dateActions(series, date, today)` for kind x date state, with
  `DATE_WHY` greyed reasons (never hidden); `addDateWhy`, `pickDayProblem`, `dateMarks` (the ONE tag
  mapping, used by both the event page's Coming rows and All dates). Labels appended to `L`
  (`L.dateAct`, `L.datePick`, filters, tags); duplicated words written once (`SKIP`, `UNSKIP`,
  `BRING_BACK`, `RESET_DATE`, `CANCEL_EVENT`).
- `p3/data/dateFacts.ts` (facts from the workspace, no import cycle), `p3/data/dates.ts` (All dates
  lists/filters, `PLAN` = the existing builders only, `resetNormalPlan` composite, `KeyRing` keeps the
  idempotency keys per plan, `sendPlan` chains the DATE version, `useSendPlan`, `useDateDetail`).
- Screens: `DateSheet.tsx` (`DateSheets` host: date sheet, cancel w/ reason, move, time, skip,
  reset to normal, Different details: Where / About / Ticket / Photo upload, break sheet, Add a date);
  one-off "Cancel the event" opens THE W2c `CancelEventSheet` (reason picker extracted as `ReasonPick`,
  shared). `AllDatesScreen.tsx` at `events/:seriesId/dates` (5 filters with counts, honest
  "newest 100 of N", empty states). `Toast.tsx` (`useToast`, moved out of EventPage). EventPage: Coming
  rows open the date sheet; "See all dates" + "Add a date".
- `COMMAND_COPY`: festival set_time, festival_extra_date, cancellation reason list, date/new_local_start
  required.
- Prod read-only (2026-10-27): `check_owner_command_allowlist_v1` c_expected = the 19 kinds in ARC-p3
  section 2 (all 8 date kinds admitted, already in `OWNER_COMMAND_KINDS`: no mirror change). Handler
  RAISE texts read for cancel / move_date / set_time / set_override / skip / unskip / add / remove.
  Survey (live+paused, counts): weekly 38 (26 over 30 coming, 1 over 100 stored, 7 cancelled coming,
  6 breaks coming, 1 own-time coming), monthly 6, course 6 (2 none coming), custom 1, festival 8,
  one-off 12 (10 none coming); 66 coming dates with an override row (10 series).
- Tests: `model/__tests__/dates.matrix.test.ts` (106 cells), `data/__tests__/dates.data.test.ts`,
  `screens/__tests__/dates.send.test.tsx` (real envelope). `vitest src/modules/organiser`: 169 files,
  4893 passed. tsc clean for touched files. `npm run lint` links all PASS except `check:integrity`
  exit 126 (sandbox: bin/check-integrity.sh not executable); run via `bash`: ok.

## Decision for the owner (fork)

The brief asks for "remove an added date", but `events/__tests__/moveNotRemove.matrix.test.ts`
pins owner answer 20 (wave B0): organisers never delete a date, no code sends `series.remove_date`.
Also prod `_cmd_series_remove_date_p5` only CANCELS a scheduled date (no reason) and deletes only a
cancelled one. I kept the guard: "Remove this date" is listed, always greyed with
`DATE_WHY.noDelete` ("Cancel it instead"). If the owner wants removal, it is a small change in
`model/dates.ts` + a builder + relaxing that guard test.

## Open / next steps

1. Browser walk 390x844 light + dark per the brief's state list, W2a spec style
   (`docs/handover/p3-w2a-walk/walk.phone.spec.ts.txt`; harness `playwright.phone.config.ts`,
   `tests/e2e-phone/`); PNGs + `metrics.jsonl` to `docs/handover/p3-w2b-dates/`. Fix any red.
2. Contrast rows in `p3/__tests__/p3Theme.contrast.test.ts` for the new `.p3-danger-t` text and the
   input `.p3-in` (tags reuse existing classes).
3. `docs/design/<pr>.md` "matches C3 / does not and why": deviations so far: no "More for this date"
   fold (every row visible so greyed reasons are seen); Remove never enabled (above); "Put this date
   back to normal" sends set_override nulls + set_time reset, NOT the programme call (C3 `resetdate`
   says sessions stay; per-date sessions are W2d); add a date greyed on a one-off (C3 draws "Add
   another date"); no "Class n of N" (A2 R2 not landed); move uses a date input, not C3's calendar.
4. Every CI job step locally (`.github/workflows`), `npm run pre-ship`, `/code-review` two rounds
   (user-facing), then the PR body's `## Verified on real data` block.
5. Not verified: no browser run; `runOccurrenceCommand`'s `new_version` assumed to be the DATE's
   version (the composite's second call sends it); cover upload not exercised; venue list only mocked.
