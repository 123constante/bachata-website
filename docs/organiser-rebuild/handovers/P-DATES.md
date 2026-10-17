# P-DATES handover -- parity fix pass, everything about ONE date

- Ticket: dt_69a2ba3d0946. Branch `claude/org-r1-parity-dates`, cut from `claude/org-r1-integrate` e04dea0.
- Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/P-DATES.md` (sha 6bb2edef). Audit: `claude/org-r1-parity:docs/organiser-rebuild/PARITY-GAP.md`.
- Files touched: only my row (`flows/change/**`, `events/EditorRows.tsx`, the dates part of `events/OneEvent.tsx`) plus additive hunks in `shared/seriesCommands.ts`, `shell/paths.ts`, `shell/OrganiserRoutes.tsx` (4 routes), the byte-pinned `shared/a1Gate.ts`, and test-only lines in `shell/__tests__/paths.test.ts` and `__tests__/consistency.render.matrix.test.tsx`. Nothing of P-SERIES's (`events/Details.tsx`, `EditorSheet.tsx`, `flows/event/**`, `flows/new/**`, `flows/Done.tsx`, `jobs/homeJobs.ts`, `LifecycleActions`) and the LifecycleActions mount region of OneEvent.tsx is untouched. `flows/cancel/**` and `dates/**` needed no change (Cancel reuses `flows/cancel` Confirm as is; the date editor already shows its refusals).

## Done (every brief row, with the audit ids)

| # | Row | What was built | Command / read |
|---|---|---|---|
| 1 | Sessions + line-up for ANY date (C13 C22 C52-C55 C59) | Change "what" row **Sessions and line-up** -> `ORG_PATHS.dateLineup`; every Coming-date row on One event and on Change "which date" gets a 44px **Sessions** link to THAT date's editor. The row reads `organiser_get_occurrence_programme_v1`: when the editor will refuse (multi-day, cancelled, past, closed) the row says why (`NOT_EDITABLE_COPY`) and still opens the read-only view; never a dead button. | `organiser_set_occurrence_programme_v1` (existing DateSheet) |
| 2 | Change time shows the sessions (C19 C61) | The 5-point spec: sessions read via the programme RPC; 1 session = start + optional end; 2+ = the list, ONE new-start box, live preview of every session's new times, "Every session moves by 1 h later/earlier", end box labelled "End of <last-ending session>"; row **Change one session's time** -> this date's editor; **Back to usual time** (`{reset:true}`) only when the date runs at its own start. One `occurrence.set_time` per save. | `occurrence.set_time` / `resetTimeCommand` |
| 3 | Cancel and Take off from Change (C23 C24 C25) | Change "what" for ANY coming date: **Take this date off** (`series.skip_date` to the EVENT at the series version; enabled exactly when `isRuleDate`, the date page's own mapping, else disabled with the reason) and **Cancel this date** -> `ORG_PATHS.cancelDate` (the `flows/cancel` Confirm, same command, not forked). Put back unchanged. | `series.skip_date`, `occurrence.cancel` |
| 4 | Note / picture / ticket link for one date (C26) | Change "what" rows -> one screen per field: note (textarea), ticket link (https check with the reason), picture (the flyer re-encode + upload pipeline, `<img loading width height>`). Untouched Save sends nothing (aria-disabled + reason). **Use the event's usual ...** clears the date's own value (null), offered only when it has one. | `occurrence.set_override {description \| ticket_url \| cover_image_url}` |
| 5 | Past dates (C39) | Collapsed **Past dates (N)** on One event using the existing `DatesList` (new `pastOnly` prop); rows open that date read-only; over the 100-date read it says older dates are not listed; renders nothing when there are none. | none |
| 6 | Move date (C20) | Row hidden behind `A1_APPLIED` (false); the `/day` URL before A1 is refused with a reason and sends nothing. Tests pin both sides of the gate; the S2 suite and S8 render matrix run the Move path with the gate mocked on. | (prod refuses `occurrence.move_date` until A1) |
| 7 | Bulk cancel / shift (C58) | **Verified on prod first** (below): admitted for owner/manager. Built **Pick several dates** (from "which date"): tick dates (44px checkboxes), Cancel (reason chips from `cancellation_reasons`) or Move by N days (-60..60; disabled with the reason on weekly/monthly series, which the server refuses), one confirm with the count, result "N done, M not changed" with each skipped date and why. Refused for a paused/ended event exactly like "which date". | `admin_bulk_occurrence_command_p5` (`occurrence.bulk_cancel` / `bulk_shift`, series target + series version) |
| 8 | Copy one date's changes (C60) | **Copy changes from another date** on the date's Change screen: lists the other dates; a date with no own changes is disabled with the reason; after picking, shows which keys will copy and sends ONE `set_override` per changed key (venue carries its city), each at the version the last returned; nothing for a key the target already holds; waits for the venue list before copying a venue; empty state offers Add a date. | `occurrence.set_override` x N |

## Prod verification (read-only, `stsdtacfauprzrdebmzg`, SELECT / pg_get_functiondef only, counts only)

- `admin_bulk_occurrence_command_p5(p_envelope jsonb)`: line 75 `IF NOT (is_admin() OR _can_act_as_organiser_p5(auth.uid()))` (owner/manager/contributor of any organiser, or an active legacy roster row), then line 127 `PERFORM _assert_can_edit_series_p5(target, actor)` (owner/manager of the series; contributors refused there). `has_function_privilege('authenticated', ..., 'execute') = true`. Kinds: `occurrence.bulk_cancel` (reason must be a `cancellation_reasons.label`, else stored as 'Other') and `occurrence.bulk_shift` (`shift_days` non-zero int; refused for `weekly`/`monthly` rules, into the past, or onto an existing date). Only scheduled, coming dates of the series among the ids change (lines 138-143); the rest are skipped silently; result `data.affected_ids`. **Conclusion: owner/mgr admitted -> built.**
- Override keys (C60): owner keys `venue_id, city_id, cancellation_reason_label, cover_image_url, ticket_url, description` (M21:639-640, as in `OWNER_OVERRIDE_KEYS`); `event_view_p5` -> `_compute_effective_occurrence_p5` returns `venue_id_override, description_override, ticket_url_override, cover_image_url_override` (lines 229-233), which is what Copy compares. City rides with venue; the cancellation label is not copied.
- "Date runs at its own time" (C61): no read exposes the per-date time change (`_cmd_occurrence_set_time_p5` stores it as session overrides / a date-time added session). Proxy: the date's own start (local-as-Z) differs from `default_local_start_time`. Prod, 1,540 coming dates of live series: 1,537 neither changed nor differing, 2 changed and differing, 1 changed but same start (an end-only change) -> **0 false positives, 1 miss (end-only)**.
- `set_time` delta: `v_delta := v_new_start - v_cur_start` added to every session as `::time` (wraps). The preview applies the same; the words use the site's 08:00 night rollover (23:00 -> 01:00 = "2 h later", 21:00 -> 08:00 = "13 h earlier").

## Decisions for the review pack (with reasons)

1. **Routes**: 4 additive routes in `shell/OrganiserRoutes.tsx` (`change/:s/pick`, `/:o/off`, `/:o/copy`, `/:o/:field`) -- the brief's screens need URLs and links must come from `ORG_PATHS`; static segments outrank `:field`, so existing routes are unaffected.
2. **"Opens the same editor"**: the Coming-date row itself still opens Change for that date (the Change flow depends on it); a separate 44px **Sessions** link on every row opens the editor in one tap. Both screens read the same.
3. **Copy is one command per key** as the brief pins (not one multi-key patch). A reply without `new_version` advances the expected version by one (every applied command bumps it) so a replay cannot strand a half copy.
4. **Take off** uses `isRuleDate` (the date page's mapping), not the series rule, so an added off-rule date is never offered a skip the date page would not offer.
5. **Back to usual time** uses the start-differs proxy above (no read exposes the change); end-only changes do not show it.
6. **Bulk shift** allowed range -60..60 days (UI cap; the server caps at 500 dates, not days).

## Code review (CLAUDE.md: two rounds for a user-facing change; stopping rule stated before the rounds)

- Round 1 (high): 10 findings. Fixed 9 (end equal to current end dropped; take-off used the series rule; Pick result showed UUIDs; past list silent over 100; Copy venue before the venue list; version chain without `new_version`; bulk left date reads stale; delta words vs rollover; Copy double tap). Not taken: "one multi-key set_override" (the brief pins one per key).
- Round 2 (medium, on the fixes): 10 findings, all fixed as edits (after-midnight sort and last-ending on the night clock; end before start refused with the reason; Pick count from still-listed ticks; Copy list/detail wording and empty state; single-session end fallback; days reason names the range; monthly shift wording; empty Past region; `emptyHint` optional). Round-2 fixes are unreviewed code by the CLAUDE.md rule. Not done: folding the three private minute helpers (programmeModel, seriesModel, changeModel) into one -- cross-slice shared files.

## Per-job CI table (run locally in the sandbox on 34ba835 + the no-social-word fix; base = e04dea0)

| job | command | exit | note |
|---|---|---|---|
| typecheck | `npm run check:rpc-typing` | 0 | |
| typecheck | `npm run check:wallclock-brand` | 0 | (the job runs no tsc) |
| (extra) | `npm run typecheck` | 2 | 97 errors = base 97, identical set; none in files this PR touches; pre-ship ratchet 97 < 106 PASS |
| unit-tests | `npm run test:unit:offline` (TZ London) | 1 | 8916 pass, 5 fail in `tests/integrityCouldNotRun.test.ts`: sandbox NODE_PATH holds a global typescript; 67/67 with NODE_PATH unset; same 5 fail on base |
| unit-tests | `npm run test:unit:timing` | 0 | |
| unit-tests | tz list in New York + Sydney | 0 / 0 | 213 each |
| unit-tests | `check-dancer-area-isolation` self-test + check | 0 / 0 | |
| organiser module | `npx vitest run src/modules/organiser` | 0 | 102 files, 2953 pass (after the word fix: change suite 118/118) |
| architecture-guard | `bash bin/check-integrity.sh` | 0 | 1891 files, 0 issues |
| architecture-guard | `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture` | 0 | |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images`; image-widths; plan-hygiene; artifact policy; mojibake; entry-point | 0 | |
| perf-budget | 3 self-tests; `npm run build` (production); `check:bundle-budget`; `check:first-load-requests`; `check:chunk-cycles` | 0 | within budget, pins match, no cycles |
| perf-budget | lighthouse, doc-weight | n/a | NOT RUN: need a preview deploy + secrets (both skip `claude/` branches) |
| e2e-smoke | `CI=true npm run test:e2e` | 1 | 157 pass, 1 skip, 1 fail `dancer-home.spec.ts:188` (profile switcher, not this PR; 14/14 alone on HEAD; fails in isolation on base too) |
| types-drift | `npm run gen:types` | n/a | NOT RUN: needs SUPABASE_ACCESS_TOKEN |
| workflow-lint | BOM, masking, notification, no-preview-prefixes (+ canaries) | 0 | |
| real-data-verified | `check-pr-real-data-verified.mjs` | 0 (self-test) | body check runs on the PR (section included) |
| ci-budget-guard | `check-ci-budget.mjs --self-test` | 0 | measure step main-only |
| lint chain | `npm run lint` | 1 -> fixed | `check:no-social-word` flagged `'Social'` in two new test files -> renamed, now 0; `check:integrity` 126 only because the hook file is not executable locally (passes via bash) |
| pre-ship | `npm run pre-ship` | 1 | integrity exec bit (sandbox) + live `*.contract.test.ts` (no DB secrets); build, budgets, typecheck ratchet, scoped eslint (26 files, 0 errors) pass |

## RED-first evidence (failing output on the unfixed code, pasted)

Behaviour suite `pdates.flow.test.tsx` before any screen existed (33 tests, 28 failed; the 5 passing were the already-true sides: Move row present with A1=true, time/venue rows offered, no reset without an own time, untouched save):
```
 ❯ pdates.flow.test.tsx  (33 tests | 28 failed) 16485ms
⎯⎯⎯⎯⎯⎯ Failed Tests 28 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > 'change-lineup' opens its screen for ANY coming date, not just the next
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > 'change-cancel' opens its screen for ANY coming date, not just the next
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > change-note is offered
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > change-ticket is offered
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > change-picture is offered
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > change-copy is offered
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > change-off is offered
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > Move to another day is shown only once admin A1 is applied (A1_APPLIED=false)
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > Move by URL before A1 is refused with a reason, never a command
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > a session editor refusal (multi_day) shows its reason on the row, never a dead button
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > a session editor refusal (date_cancelled) shows its reason on the row, never a dead button
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > a session editor refusal (past_date) shows its reason on the row, never a dead button
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > Take this date off: disabled with a reason on a date that is not from a weekly repeat
 FAIL  pdates.flow.test.tsx > P-DATES: what can change on one date (C4) > Take this date off sends ONE series.skip_date to the event at the series version
 FAIL  pdates.flow.test.tsx > P-DATES: Change time shows the sessions (C19, C61) > one session: a start and an optional end; the end goes with the start
 FAIL  pdates.flow.test.tsx > P-DATES: Change time shows the sessions (C19, C61) > class + social: lists both, previews every new time and says every session moves
 FAIL  pdates.flow.test.tsx > P-DATES: Change time shows the sessions (C19, C61) > "Change one session’s time" opens THIS date’s session editor
 FAIL  pdates.flow.test.tsx > P-DATES: Change time shows the sessions (C19, C61) > Back to usual time only when the date runs at its own time (own='21:30')
 FAIL  pdates.flow.test.tsx > P-DATES: note / ticket link / picture for one date (C26) > 'note': an untouched Save sends nothing; a typed one sends ONE set_override {'description'}
 FAIL  pdates.flow.test.tsx > P-DATES: note / ticket link / picture for one date (C26) > 'ticket': an untouched Save sends nothing; a typed one sends ONE set_override {'ticket_url'}
 FAIL  pdates.flow.test.tsx > P-DATES: note / ticket link / picture for one date (C26) > a ticket link that is not a web address stays disabled with the reason
 FAIL  pdates.flow.test.tsx > P-DATES: note / ticket link / picture for one date (C26) > a date with its own note can go back to the usual one (null)
 FAIL  pdates.flow.test.tsx > P-DATES: copy one date’s changes from another (C60) > a source date with no changes of its own is disabled with the reason
 FAIL  pdates.flow.test.tsx > P-DATES: copy one date’s changes from another (C60) > copies each changed key as ONE set_override, each against the version the last returned
 FAIL  pdates.flow.test.tsx > P-DATES: pick several dates (C58) > Which date offers "Pick several dates" and every row a Sessions link
 FAIL  pdates.flow.test.tsx > P-DATES: pick several dates (C58) > cancel: one call with the ticked ids at the series version; the result says N done, M not changed, and why
 FAIL  pdates.flow.test.tsx > P-DATES: pick several dates (C58) > move together is disabled with the reason on a weekly repeat
 FAIL  pdates.flow.test.tsx > P-DATES: pick several dates (C58) > move together on listed dates sends bulk_shift with the days
 Test Files  1 failed (1)
      Tests  28 failed | 5 passed (33)
```

One event (`pdates.oneEvent.test.tsx`) before the Sessions link / Past dates:
```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/modules/organiser/events/__tests__/pdates.oneEvent.test.tsx > P-DATES: one event > every coming date has a Sessions link to THAT date’s session editor (C59)
TestingLibraryElementError: Unable to find an element by: [data-testid="org-coming-sessions"]
 FAIL  src/modules/organiser/events/__tests__/pdates.oneEvent.test.tsx > P-DATES: one event > the past dates are listed collapsed under "Past dates" and open that date (C39)
TestingLibraryElementError: Unable to find an element by: [data-testid="org-dates-past-toggle"]
 FAIL  src/modules/organiser/events/__tests__/pdates.oneEvent.test.tsx > P-DATES: one event > the coming dates are not listed twice (the past list carries no upcoming card)
TestingLibraryElementError: Unable to find an element by: [data-testid="org-dates-past-toggle"]
      Tests  3 failed (3)
```

Dates consistency matrix: found a real gap (Pick did not refuse a non-live event), red before the fix:
```
⎯⎯⎯⎯⎯⎯ Failed Tests 12 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/modules/organiser/__tests__/consistency.dates.matrix.test.tsx > P-DATES matrix: the same coming dates, each with its own Sessions link > ended-picnic: Pick is refused with the same words as Which date
TestingLibraryElementError: Unable to find an element by: [data-testid="change-refusal"]
 FAIL  src/modules/organiser/__tests__/consistency.dates.matrix.test.tsx > P-DATES matrix: the same coming dates, each with its own Sessions link > ended-upcoming-cancelled: Pick is refused with the same words as Which date
TestingLibraryElementError: Unable to find an element by: [data-testid="change-refusal"]
 FAIL  src/modules/organiser/__tests__/consistency.dates.matrix.test.tsx > P-DATES matrix: the same coming dates, each with its own Sessions link > ended-course: Pick is refused with the same words as Which date
      Tests  12 failed | 57 passed (69)
```

Review-round regressions, red before the fixes:
```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/modules/organiser/events/__tests__/pdates.oneEvent.test.tsx > P-DATES: one event > over the 100-date read, the past list says older dates are not listed (REVIEW P-DATES 4)
 FAIL  src/modules/organiser/flows/change/__tests__/pdates.flow.test.tsx > P-DATES: Change time shows the sessions (C19, C61) > a typed end equal to today’s end is kept when the start moves (REVIEW P-DATES 1)
 FAIL  src/modules/organiser/flows/change/__tests__/pdates.flow.test.tsx > P-DATES: Change time shows the sessions (C19, C61) > a move to the morning reads as earlier, a move past midnight as later (the 08:00 rollover)
 FAIL  src/modules/organiser/flows/change/__tests__/pdates.flow.test.tsx > P-DATES: pick several dates (C58) > cancel: one call with the ticked ids at the series version; the result says N done, M not changed, and why
 FAIL  src/modules/organiser/flows/change/__tests__/pdates.model.test.ts > timeDelta: the shorter way round the clock > 21:00 -> 08:00 = -780
      Tests  5 failed | 65 passed (70)
```
The pure model tests (`pdates.model.test.ts`) were written after the model code; the behaviour rows above are the red-first proof for every brief row.

## Browser walk (390x844, phone harness `playwright.phone.config.ts` + fake Supabase, prod-shaped fake data: weekly Friday series, 3 coming + 2 past dates, class 20:00-21:00 + party 21:00-02:00)

7 screens, run twice: One event, One event with Past dates open, Which date, What changes, Change time (typed 21:00: Class 21:00-22:00, party 22:00-03:00, "Every session moves by 1 h later" -- screenshot checked by me), Note, Pick (2 ticked; Move disabled with the reason). Every screen: scrollWidth 390 (no horizontal scroll); 0 organiser controls under 44px; no raw entities; no overlap or clipping; Move row absent (A1 gated). Site-wide footer links (~14px high) fail 44px on every page: pre-existing, not this PR. An untitled class reads "Class / Class" (name + type): redundant, not broken. The temporary spec was deleted.

## Verified / Not verified

- Verified: every brief row by table-driven tests (behaviour + matrix over every prod shape in `__tests__/shapes`); prod permissions and RPC contracts read-only (above); every CI job step that runs without secrets (table); production build + perf budgets; a 390x844 browser walk of 7 screens on fake prod-shaped data.
- **Not verified**: no real-phone run; no live storage (picture upload not exercised end to end); no write against a real database (E2E project `srrpvuxldthwumzrngla` not used; every command checked by its envelope only); bulk cancel/shift never executed for real; 360x640 and iOS Safari; keyboard-open layout on the note/time screens; lineup/venue/ticket/picture/copy/off/cancel screens not walked in a browser; types-drift, lighthouse, doc-weight, live contract suites (secrets).

## Left / exact next steps

1. Owner phone test of: One event -> Sessions on a non-next date; Change -> Change the time on a class+social date; Take this date off; Note; Pick several -> Cancel 2 dates (E2E data first).
2. When admin A1 (migration 20261126190000) is on prod: flip `src/modules/organiser/shared/a1Gate.ts` to `true` in the merge train (both branches carry the byte-identical file); `pdates.flow.test.tsx` "Move ... A1_APPLIED" rows pin both sides.
3. Optional follow-ups (not in scope): fold the three private minute helpers (programmeModel / seriesModel / changeModel) into one exported night-clock helper; site footer link tap size; "Class / Class" redundancy on untitled sessions (sessionSummary is read-only for slices).
4. Working-tree side effects of the local CI run, NOT committed: 10 `tests/regression/today/__snapshots__/*.snap` (line endings only) and untracked `docs/handover/dancer-rebuild-w2b/`, `w2e/`.
