# ER-FIX2-S6: C9 dates (one date) - fix handover

Ticket `dt_6820a0cb79f6`. Brief `ER-FIX-W2.md` section "S6 C9 dates" (sha a2e612d). Audit `ER-AUDIT-dates.md` (claude/audit-er-dates). Branch `claude/er-c9-dates`.

## Merges (Rules for every worker)
1. `origin/main` (21 behind): 4 conflicts, all the Ember UI files (`ui/Chip.tsx`, `ui/DateChip.tsx`, `ui/ember.css`, `__tests__/ember.test.tsx`). Main's side taken: it is a superset of the wave-1 versions (onRemove chip, `--r-date`, `--gold-fg`, scope tests).
2. S1 `origin/claude/er-s1-rules` (79459ca5), S2 `origin/claude/er-c4-sessions` (48eafa56), S3 `origin/claude/er-c5-venue` (4e6d5a65): all three merged CLEAN (no hunk in sessions/** or venue/** needed a side).

## Server facts checked (prod, read-only SELECT on pg_proc / schema_migrations, 2026-10-22)
- AD2 is applied: 20261203180000 .. 20261203250000 all in `schema_migrations`.
- The admin repo was NOT reachable from this session (add_repo: no access), so `ER-AD2.md` itself was not read; the live function bodies were read instead.
- **F-C9-9 verified, no client change:** `organiser_set_occurrence_programme_v1` writes session overrides / date-only sessions; the triggers `trg_recompute_p5_headline_time` on `event_occurrence_session_override_p5` and `event_occurrence_added_session_p5` call `_recompute_occurrence_headline_time_from_sessions_v1`, which sets the date's `materialised_start_utc` / `_end_utc` from its sessions. A time shift through the programme writer DOES move the date's own start. Sending `occurrence.set_time` as well would be a second write for nothing.
- **F-C9-6 / decision 11: no end-event command.** AD2 adds none. `series.end_run` refuses a series with no evidenced night (every one-off that has not run yet) and takes no reason. PARKED (`er/parked/ER-C9.md`).
- **F-C9-7: resolved by AD2 on the server.** No live function raises "for the owner organiser's team only" any more; `check_owner_command_allowlist_v1` asserts the AD1 owner-team gate is ABSENT ("ER AD2 FIX: everyone on an event has full control"). No client change.
- The writer refuses a NEW session without a title or without both times (`title is required`, `needs both start_time and end_time`); a STORED untimed / untitled session round-trips because an unchanged field is never re-validated. This decides F-C9-1 and F-C9-4.

## Findings

| id | outcome | what changed | red-first proof |
|---|---|---|---|
| F-C9-1 blocker | FIXED | `copyFromDate` (dates/dateChanges.ts): a series session stays the same session and takes the source's values as an edit; an untimed / untitled source keeps this date's stored value, so nothing the writer would refuse is sent. `copyRowsFrom` kept as a wrapper (export not renamed). | `erFix2S6.pure.test.ts` 5 prod shapes (untimed, untitled, both, date-only class, moved) red on the C9 copy; `dateChanges.matrix.test.tsx` "an untimed, untitled source session copies and saves" red on unfixed code (C9 sent 2 removed + 2 new rows) |
| F-C9-2 major | FIXED | Copy never removes and re-adds series sessions (the date stays on the series); people follow the source's teachers/DJs, team-set roles (MC, performers) stay. This date's own date-only sessions come off; the source's go on as new. | same tests ("never re-created", "people follow; an MC stays") red first |
| F-C9-3 major | FIXED (behind the switch) | Rebuilt screens: no "Take this date off" on the date page, and the `change-off` row is hidden on Change "What changes". Off the switch the old screens are unchanged (ER-S0: old screens stay until "*"). | matrix "no Take this date off" and whatChanges "switch on = true" red first |
| F-C9-4 major | PARKED | Server refuses a new untimed session (above). Copy counts a skipped untimed date-only source session and says so on the page (0 on prod). | n/a (server) |
| F-C9-5 major | FIXED | `dates/index.tsx` reads `useRebuildSwitch(event organiserIds)` (S1's per-event switch, owner page first) via `useEventWorkspace`; Night starts, one-off Day, Copy and the parked "Cancel the event" show only when ON; the page waits for the read (no flash). `WhatChanges.tsx` hides its duplicate time / copy / take-off rows when ON (and while the read loads). | matrix "switch OFF" + rebuilt rows; whatChanges test red first |
| F-C9-6 major | PARKED (decision 11) | Rebuilt one-off: "Cancel the event", disabled, "Not available yet"; never sends `occurrence.cancel`. | pure + matrix "a one-off's is off with the reason" red first |
| F-C9-7 major | RESOLVED BY AD2 | none (server gate dropped, see above) | n/a |
| F-C9-8 major | FIXED | One-off move is a list of the next 30 days minus its own day and the event's dates (`moveDayOptions`). Main deleted `flows/change/Day.tsx` / `moveDays` (owner C20, #880), so the brief's "reuse moveDays" could not be literal; the same rule is rebuilt in 10 lines. | pure + matrix "a list of valid days" red first |
| F-C9-9 major | VERIFIED, no change | server recomputes the date start from sessions (above) | n/a |
| F-C9-10 minor | FIXED | A cancel / put-back refused while a fresh read shows the date already in that state is success (`commandSettled`, `useDateEditor.runCommand`). | matrix: version_conflict and already-cancelled refusals red first |
| F-C9-11 minor | FIXED | Day row also needs `A1_APPLIED`. | covered by the one-off matrix rows |
| F-C9-12 minor | FIXED | Night starts is an inline `<select>` (48px) in the Where card, usual start marked "(usual)"; the second sheet ("time" view, "(now)") is gone. | pure "(usual)" + matrix select test red first |
| F-C9-13 minor | PARTLY: DISAGREE on the tick | Helper paragraphs in the move / copy / time views removed. The cancel tick stays: it is the shared `confirmCopy('cancel_date')` hard confirm every cancel flow in the organiser uses (flows/cancel, Pick); dropping it here alone would make two cancel confirms differ. | n/a |
| F-C9-14 minor | FIXED | Copy lists only coming, not-cancelled dates WITH own changes (`hasOwnChanges`). | pure + matrix red first |

Superseded tests rewritten (not deleted): `dateChanges.pure.test.ts` (one-off cancel words, copy sources, copy replaces), `dateChanges.matrix.test.tsx` (now rebuilt ON / OFF, inline select, move list, own-changes copy, retried cancel).

Red-first runs: `erFix2S6.pure.test.ts` 19 of 24 red on unfixed `dateChanges.ts` (the 5 green are guards for behaviour that did not change); `dateChanges.matrix.test.tsx` 12 of 20 red on the merged-but-unfixed head (8 green: untouched / lock / reason-list guards); `erFix2S6.whatChanges.test.tsx` 1 of 2 red (the OFF case is the unchanged guard).

## Shapes
Survey (prod `stsdtacfauprzrdebmzg`, SELECT counts only, 2026-10-22, coming scheduled dates of live series): 1484 dates (recurring 1463, course 14, festival 5, one_off 2); date-only sessions 2 on 2 dates, 0 untimed, 0 untitled; session overrides 9 rows on 4 dates, 0 cancelled. Untimed 223 / untitled 239 series sessions: from ER-COMMON / the audit, not re-counted.

Checked in tests: recurring, course, festival day, one-off upcoming, one-off past (locked), cancelled-by-retry; untimed series session, untitled series session, both, date-only class, moved session, source-cancelled session, MC on a line-up, source date-only untimed (skip) and untitled (default name).
Not checked: dates past the 100-row workspace page; two-organiser events in a browser; course-specific copy wording (treated as recurring).

## CI per job (local sandbox, TZ=Europe/London)
| Job (workflow) | Step(s) run | Result |
|---|---|---|
| unit-tests | `npm run test:unit`; `check:dancer-area-isolation` (+ self-test) | 12880 pass / 16 fail. None in this slice: 13 are live-DB contract tests (`tests/*contract*`, need the CI DB secret; `ci-live-db-gate` gates them), 2 are `tests/integrityCouldNotRun.test.ts` (sandbox toolchain), 1 is `events/__tests__/datesCard.consistency.test.tsx`, which fails the same on `origin/main` and on S3's head (date-dependent, not this slice). dancer isolation: pass |
| organiser slice | `vitest run src/modules/organiser` | all pass except the same `datesCard.consistency` case; dates 231/231, change flow 170/170 |
| typecheck | `check:rpc-typing`, `check:wallclock-brand` | pass, pass. (Whole-tree `npm run typecheck` is NOT a CI step and has 100 errors on main's tree; 0 in `organiser/dates` or `flows/change`.) |
| architecture-guard | integrity (`bin/check-integrity.sh`), `check:legacy-tables`, `check:legacy-program-rpcs`, `lint:architecture`, `AUDIT_STRICT=1 check:images`, `check:image-widths` (+ self-test), mojibake | all pass |
| lint chain | `npm run lint` (after `chmod +x bin/*.sh`, as CI does) | exit 0, 20/20 links green; trailing whole-tree eslint informational (red on main); `eslint src/modules/organiser/dates src/modules/organiser/flows/change`: 0 errors |
| perf-budget | `npm run build`, `check:bundle-budget`, `check:first-load-requests`, `check:chunk-cycles` | all pass |
| e2e-smoke | `npm run test:e2e` | 158 passed, 7 skipped |
| db-contract-check, live-qa, og/seo, lighthouse, phone-qa | need live secrets / a deploy | not run here |

Note: the unit run rewrote some tracked snapshot and PNG files outside this slice; they were restored, not committed.

## Verified / Not verified
Verified: everything in the tables above; server behaviour for F-C9-6/7/9 and the new-session rule read from live function bodies.
Not verified: browser walk at 390x844 (no signed-in organiser session in this sandbox); end-to-end save against prod (no writes allowed); `ER-AD2.md` text (admin repo not reachable); the Vercel preview of the final push (VERCEL_TOKEN is set; checked after the push, result in the worker report, not here).

## Next
- Owner: the parked end-a-one-off command (decision 11) and untimed new sessions (F-C9-4) are admin asks.
- S5 (event page) merges this head; it mounts the same per-event switch.
