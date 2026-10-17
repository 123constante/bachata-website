# REVIEW-PAR-A -- parity pass on PR #809: correctness and data

- Ticket dt_da20faf11517. Reviewer, one pass. Branch `claude/org-r1-review-PARA` cut from `claude/org-r1-integrate` 5369379.
- Scope: `git diff e04dea00..origin/claude/org-r1-integrate` (P-DATES + P-SERIES + INT3), brief `R-PAR-A.md` (method from `R-INT-A.md`).
- Prod `stsdtacfauprzrdebmzg`: SELECT and `pg_get_functiondef` only, counts only. No write.
- No source file changed; this file is the only commit.

**Verdict: 1 BLOCKING / 3 SHOULD / 4 NOTE**

---

## BLOCKING

### B1. Change time: a typed end lands on a different session than the preview shows (241 coming dates on prod)

- Where: `src/modules/organiser/flows/change/changeModel.ts:182-190` (`lastEnding`, night clock), used by `previewTimes` (`:170`) and by `flows/change/Time.tsx:53` and `:66` (the "End of <session>" label).
- Why: prod `_cmd_occurrence_set_time_p5` picks the session(s) that get the typed end with `max(eff_end)` on a plain `time` (`agg ... max(eff_end) AS mx`, then `FILTER (WHERE eff.eff_end = agg.mx)`). It does not use a night clock. On a class 20:00-21:00 + party 21:00-02:00 night, `max(21:00, 02:00) = 21:00`, so the server gives the typed end to the **class**. The screen labels the box "End of Late Party" and the preview shows the party's end changing.
  - Example: start 20:30, end 03:00.
  - Preview: Class 20:30-21:30, Party 21:30-03:00.
  - Server: Class 20:30-**03:00**, Party 21:30-02:30.
  - This is owner priority (1): the preview does not match what the server does on the exact class+social shape the brief names.
- Evidence:
  - The function body, read on prod: `v_maxend_items := array_agg(program_item_id) FILTER (WHERE eff_end = agg.mx)`, with `mx = max(eff_end)` over `time` values. The `IF v_new_end IS DISTINCT FROM (v_cur_end + v_delta)` branch then writes `end_time = v_new_end` to those items only.
  - Client, scratch vitest (deleted after):
    `client lastEnding p [... Class newEnd "21:30", Party newEnd "03:00"]`
  - Prod count: coming scheduled dates of live non-festival series with 2+ sessions = 1,354. Of those, **241** have one session that ends after midnight and another that ends before it, so a typed end goes to the session the screen does not name. At series level that is 19 of 57 multi-session live series.
  - The tests pin the client model, not the server. A mutant that makes `lastEnding` match the server (`const abs = en;`) goes RED:
    ```
    FAIL pdates.model.test.ts > previewTimes ... > an end replaces only the social (it ends last, after midnight)
    FAIL pdates.model.test.ts > previewTimes ... > the last-ending session counts an after-midnight end as later
    Tests  2 failed | 118 passed (120)
    ```
    (reverted). The behaviour test "class + social: lists both ..." never types an end, so nothing renders the server's real result.
- The start delta is fine on prod today. The server's `v_cur_start = min(eff_start)` is also a plain clock, but on all 1,530 coming dates with sessions the date's own start equals that clock minimum: query `start_differs_from_server_min = 0`. The preview's delta therefore matches the server everywhere today.
- Fix, one sentence: when 2+ sessions are present and the clock-max end is not the night-last end, either show the server's real target (preview and label "End of <clock-max session>") or hide the end box and send the person to "Change one session's time". Separately, raise the night-clock `max(eff_end)` as an admin-repo defect in `_cmd_occurrence_set_time_p5`.

---

## SHOULD

### S1. Pick several dates: refusals of the whole call show "Something went wrong"

- Where: `flows/change/Pick.tsx:57` (days range -60..60) and `:78` (`commandErrorMessage`). `shared/selfServeErrors.ts` has no row for these.
- Why: prod `admin_bulk_occurrence_command_p5` refuses the whole call in three cases, and each one reaches the person as GENERIC "Something went wrong. Please try again.":
  - `contract_violation: shift would move a date into the past` (the UI allows -60 days);
  - `contract_violation: shift would collide with an existing date` (this check counts cancelled dates too);
  - `bulk_too_large`.
  Owner priority (4) asks for the reason. "Try again" also invites a retry that will fail the same way.
- Evidence: `grep -n "contract_violation\|bulk_too_large" -r src/modules/organiser --include=*.ts` (non-test) prints nothing. GENERIC = `'Something went wrong. Please try again.'` (`selfServeErrors.ts:98-99`).
- Fix: add two `COMMAND_COPY` rows (`/shift would move a date into the past/`, `/shift would collide/`), each with a plain reason. Also refuse a past-landing shift on the client, using the ticked dates and `today`.

### S2. Stop repeating: "N after them come off" is wrong when a date after the cut has its own changes

- Where: `flows/event/EventStep.tsx:67-71` (P-SERIES last-date picker, C16).
- Why: prod `_cmd_series_stop_repeating_p5` leaves out of deletion any candidate where `_occurrence_is_curated_v1(id)` is true. It also turns a date with bookings into *cancelled*, which dancers see, rather than removing it. The screen counts every coming date after the cut as "comes off".
- Evidence: the function body (read above). Prod count: 65 of 1,554 coming scheduled dates of live/paused ruled recurring series are curated, and 0 have bookings today.
- Fix: count `gone` only over dates without `has_override` (or the field the curated check mirrors), and say "N with their own changes stay".

### S3. Copy changes: a failure partway through is not shown as half done

- Where: `flows/change/Copy.tsx:83-85` and `useChange.ts` `sendAll`.
- Why: if key 2 of 3 fails, the screen shows only the generic error. The detail read reloads after key 1 succeeds, so the key list quietly shrinks to the keys still missing. Nothing says "Venue copied; note not copied". A retry does work: the idempotent replay, or the reloaded version, makes the second Copy send only the rest. But owner priority (5) asks for a *clear* half-done state, and no test covers a mid-copy failure.
- Fix: in `sendAll`, collect the keys that were applied and show "<k> copied, <rest> not copied: <reason>"; add a test where the second `set_override` rejects.

---

## NOTE

- **N1. Parity-matrix reachability is a text match.** `parity-matrix.test.ts:390-393` checks `read(file).toContain(token)`. A mutant that removes the Pick row from `WhichDate.tsx:79` but leaves `{/* ORG_PATHS.changePick */}` stays **green**: `Tests 266 passed (266)`. The behaviour suite catches the same mutant (`pdates.flow ... Which date offers "Pick several dates" ... 1 failed`), so the pair holds. The matrix alone does not prove a screen is reachable.
- **N2. Change time is not refused for a festival.** The server raises `invalid_payload: per-date time is not supported for festivals` and the screen shows GENERIC. I did not count how many festival series reach Change (`changeableSeries` filters on `live` only). For multi-day non-festival series, set_time would shift every programme day: 0 live such series on prod, so this is latent.
- **N3. The usual end (C14) is described correctly.** `_cmd_series_upsert_p5` re-times existing dates only when `default_local_start_time` changes, and it skips dates with their own session times, so `END_CONSEQUENCE` matches. On a series with programme sessions the public end comes from the sessions, so the new length shows only where no session times exist.
- **N4. Prices (C09b) match `_owner_passes_problem_p5`.** Keys, at most 10, uuid ids, name 1-120 characters, price `^\d{1,6}(\.\d{1,2})?$` or null, GBP/EUR/USD. The client does not check description length (500) because the UI does not edit the description; a kept long one passes through unchanged.

## Owner priorities: what holds

| # | Priority | Result |
|---|---|---|
| 1 | Change time preview = `_cmd_occurrence_set_time_p5` | **B1**. The delta matches (0 prod dates differ). The typed end target is wrong on 241 dates. Reset = one `{reset:true}`, matching the server reset branch. End-only change is sent as `{new_local_start: current, new_local_end}`, delta 0: matches. Multi-day: N2. |
| 2 | Sessions editor for any coming date, refusals with a reason | Holds: `LineupRow` + `NOT_EDITABLE_COPY` (multi_day / date_cancelled / past_date tested). |
| 3 | Take off / Cancel / put back: one command each, `from=change` | Holds: `series.skip_date` to the series at the series version; Cancel reuses `flows/cancel` Confirm; the `?from=change` back is mutation-proved (M5). |
| 4 | Pick several: bulk envelope vs prod | The envelope `{target_id: series, expected_version: series.version, idempotency_key, command}` and kinds/keys (`occurrence_ids`+`reason` / `shift_days`) match the prod body. Owner/manager admitted (`_can_act_as_organiser_p5` + `_assert_can_edit_series_p5`). "N done, M not changed" matches `affected_ids`. The id set is only still-listed ticks. **S1** for whole-call refusals. |
| 5 | Copy: one set_override per key, version chain | Holds (M4 red); **S3** for the half-done state. |
| 6 | P-SERIES rows | Go live/Discard/See it live: one mapping (`lifecycleModel`). Prices: N4. Usual end: N3. Stop repeating: **S2**. Make it weekly: only for `recurring` with no rule (reviewed in the diff, not against the server body). |
| 7 | `A1_APPLIED=false` everywhere | Holds. Grep of `A1_APPLIED`, `lifecycleCommand('live')`, `moveDateCommand`, `changeDay`: every Go live / Move offer is gated (`LifecycleActions` via `lifecycleRows`, `new/model.ts` `liveCommands`/`finishLabel`, `Day.tsx:31`, `WhatChanges.tsx:38`). `EventStep` `lifecycleCommand(to)` is Resume (paused -> live) only. |

## Mutation proof (each red pasted, then `git checkout` of the file; tree clean after)

| # | Mutant | Test | Result |
|---|---|---|---|
| M1 | `bulkCancelCommand` key `reason` -> `cancel_reason` (`seriesCommands.ts`) | parity-matrix | RED `C58 ... bulkCancelCommand( builds exactly its kind and keys` -- `expected [ 'cancel_reason', 'occurrence_ids' ] to deeply equal [ 'occurrence_ids', 'reason' ]` |
| M2 | Pick row removed from `WhichDate.tsx:79` | parity-matrix | RED `C58 ... reachable from flows/change/WhichDate.tsx (ORG_PATHS.changePick)` |
| M2b | same, token left in a comment | parity-matrix / pdates.flow | GREEN 266/266 (N1) / RED `Which date offers "Pick several dates"` |
| M3 | `skipDateCommand` kind -> `series.skip_occurrence` | parity-matrix | RED `C24 ... expected 'series.skip_occurrence' to be 'series.skip_date'` |
| M4 | `sendAll` stops advancing the version | pdates.flow | RED `copies each changed key ... expected [ 5, 5 ] to deeply equal [ 5, 6 ]` |
| M5 | Confirm `from=change` back ignored | pdates.flow | RED `Cancel this date opens the cancel screen ...; Keep it and Back return to Change` |
| M6 | `WhatChanges` `A1_APPLIED &&` -> `true &&` | pdates.flow + consistency.matrix | RED `Move to another day is shown only once admin A1 is applied (A1_APPLIED=false)` |
| M7 | Pick `seriesLock` refusal removed | consistency.dates.matrix | RED 9 rows, e.g. `ended-picnic: Pick is refused exactly as Which date` |
| M8 | `lastEnding` made to match the server | pdates.model | RED 2 (the tests pin the client's night clock: B1 evidence) |

## CI table (sandbox, head 5369379; base counts from the P-DATES/INT3 handovers on e04dea0)

| job | command | exit / result |
|---|---|---|
| typecheck | `npm run check:rpc-typing`; `check:wallclock-brand` | 0; 0 |
| (extra) | `npm run typecheck` | 97 errors = base 97 |
| unit-tests | `TZ=Europe/London env -u NODE_PATH npm run test:unit:offline` | 0: 391 files, 9229 pass, 18 skip |
| organiser | `npx vitest run src/modules/organiser` | 0: 105 files, 3251 pass, 2 skip |
| lint chain | `npm run lint` | PASSED, 20 of 20 links (eslint informational) |
| perf-budget | `npm run build` (production); `check:bundle-budget`; `check:first-load-requests`; `check:chunk-cycles` | 0 each |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images`; mojibake, lint:architecture, legacy-tables, legacy-program-rpcs (in the lint chain) | 0 |
| e2e-smoke | `CI=true npm run test:e2e` | NOT RUN (INT3 ran it: 158 pass, 1 skip) |
| lighthouse, doc-weight, types-drift, live contract suites | -- | NOT RUN: need a deploy or secrets |

The local `chmod +x` on `bin/*.sh` and `.claude/hooks/*.sh` (so check:integrity could run) is reverted and not committed.

## Verified

- The prod bodies of `_cmd_occurrence_set_time_p5`, `admin_bulk_occurrence_command_p5`, `_owner_passes_problem_p5`, `_cmd_series_stop_repeating_p5`, and the `_cmd_series_upsert_p5` duration/re-time lines, read and compared to the client.
- Prod counts: the 241-date shape for B1, 0 start-delta mismatches, 0 live multi-day non-festival series, 65 curated coming dates.
- 8 mutants (7 red, 1 green survivor = N1, which the behaviour suite catches).
- The CI steps in the table, run on this head.

## Not verified

- No write anywhere, so B1 is proved from the function body plus a client simulation, not by running set_time on a real date.
- No browser walk (reviewer; INT3 walked 390x844).
- e2e-smoke, lighthouse, doc-weight, types-drift.
- The festival reach count (N2).
- The Make-it-weekly server body.
- The GitHub PR checks on this head (no `gh api`).
- Vercel: no `VERCEL_TOKEN` in this sandbox -> needs owner: Vercel token.
