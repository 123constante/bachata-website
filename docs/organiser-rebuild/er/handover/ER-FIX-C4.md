# ER-FIX-C4 handover (ticket dt_59c5c7f18fa2, branch `claude/er-c4-sessions`)

Fix pass for review `ER-W1.md` section ER-C4 (findings C4-1..C4-12), per brief `ER-FIX-W1.md` section C4.
Files: `src/modules/organiser/sessions/{sessionsModel.ts,SessionCard.tsx,SessionSheet.tsx}`, new tests
`__tests__/sessionsFix.test.ts` and `__tests__/SessionSheetFix.test.tsx`, two old tests updated (they pinned the C4-1 bug).
Parked questions: `docs/organiser-rebuild/er/parked/ER-FIX-C4.md`.

## Per finding

| # | Outcome | What changed | Red first on unfixed code |
|---|---|---|---|
| C4-1 | fixed | Level never makes an issue, for new or loaded sessions. Decision from the plan: rule 11 lists "level per class" under OPTIONAL details, rule 10 (blockers) has no level, so the "only if the rules say a class needs one" case does not exist; the issue is dropped entirely. Load `[]`, save `[]`. | yes (3 tests) |
| C4-2 | fixed | Each card always shows its reason (`showIssues` defaults to true, `tried` removed), with `aria-live="polite"`. | yes |
| C4-3 | fixed | Untimed: Start has a "Pick a start" placeholder, End is disabled with the same placeholder, quick-length chips are disabled, the reason is "Pick a start time". | yes |
| C4-4 | fixed | `MAX_SESSION_MINUTES` = `LIMITS.sessionMaxMinutes` (12 h, `shared/programmeModel.ts`; this repo has it there, not `events/`). When C3's `maxSessionMinutes` lands in `eventRules.ts`, point at it (same value). A stored end past the cap stays a selectable option and the card says "Over 12 hours" without blocking Done. | yes (2) |
| C4-5 | fixed | Done on a list whose saved shape equals the initial one closes without `onSave`. Pressing Other or opening the room box is not a change. | yes |
| C4-6 | fixed | `roomVisible` is null-safe; `fromStored` maps a null room to `''`. | yes |
| C4-7 | fixed | Added `fromStored(row, people?)` and `toStored(draft)` with the `StoredSessionRow` type. Table-tested on the review's prod shapes: HH:MM:SS, untimed (223), 00:00 end (2), off-grid (40), over 720 (7), off-list lessons (47), null room (552), `performance` -> showcase, unknown kind (`show`) kept as is. | yes (9 rows) |
| C4-8 | fixed | `fromStored` derives `otherLength`; `showQuickLengths` also follows `otherLengthSelected`, so Other is never pressed while the end is read-only. | yes |
| C4-9 | fixed | `SESSION_REASONS`: name = `rules.blockers.name`, bad times = `rules.blockers.sessionTimes`; "Pick a start time" and "Over 12 hours" are local constants (no key in the JSON, and the JSON was not edited). The step (15) and the 120-minute non-lesson default are named local constants. | yes |
| C4-10 | fixed | The separator is JSX `&middot;`. A test fails on any non-ASCII byte in the three session sources. | yes |
| C4-11 | fixed (test only) | A new test asserts `document.activeElement === opener`. The code was already correct, so the test was green on unfixed code. Mutation proof: making SheetView's `onCloseAutoFocus` focus `body` turned the new test RED while the old test stayed green. SheetView was then restored. | n/a (mutant RED) |
| C4-12 | fixed | Disabled Done has `aria-describedby` pointing at the footer reason. | yes |

Red proof: with the new tests on the unfixed code, `npx vitest run src/modules/organiser/sessions` gave 26 failed / 124 passed.

## Review rounds (stopping rule: user-facing change, so two rounds; round 2 was final)

Round 1 (/code-review medium, 10 findings):
- Fixed: untimed sessions no longer get a made-up end (`newSession`, `setKind`, `addAnother` follows the latest TIMED session); length chips are disabled when untimed; `toStored` sends a null type back as null; an unknown level key survives `toggleLevel`; the initial snapshot is memoised; card reasons are no longer `role="alert"` on mount.
- Disagreed:
  - "Over 12 h passes Done and the writer refuses": the writer checks times only when they changed (`programmeModel.ts` `validateProgramme`, `if (c.times)`), and the picker cannot produce a changed over-cap time.
  - "`initial` frozen at mount": `list` is frozen at mount the same way by design; callers mount the sheet per open (as the tests do).
  - "dead `'level'` code": kept because the brief says ADD, never remove a public export.

Round 2 (/code-review medium, 10 findings):
- Fixed:
  - blocking is now per FIELD like the writer: a name issue blocks only when the name changed, a times issue only when the times changed, everything on new sessions;
  - an untimed lesson loads on the quick lengths;
  - `aria-live` on card reasons;
  - parked-doc wording;
  - a null stored title shows the kind's name but goes back as null unless edited (`titleWasNull`, an added optional field);
  - `endOptions` is computed once per card.
- Disagreed:
  - "`setStart` clamps an over-cap length": moving the start is a times change the writer re-checks against 12 h, so it must yield a valid length; the new end is visible on screen.
  - "null/unknown kind gets an empty name": prod has 0 null types (survey below), and unknown kinds keep their stored title.
  - "`isUntouched` duplicates the sheet": both call the one `savedSnapshot`.
  - "`listIssues` dead": exported, kept (ADD-only rule).
- The tests added for round 1 and round 2 fixes were written with the fix and were NOT run against the pre-fix code.

## Prod shape survey (read-only SELECT, counts only)
`event_series_program_item_p5` by type:
- party 365: 220 untimed, 332 null room, 224 no title;
- class 272: 3 untimed, 134 no level, 15 no title;
- masterclass 19: 8 no level;
- workshop 2;
- performance 2;
- competition 1;
- show 1 (unknown kind).

## CI steps run in the sandbox (final code unless marked)

| Job | Command | Exit |
|---|---|---|
| integrity | `bin/check-integrity.sh` (after `chmod +x bin/*.sh` as CI does; mode restored before commit) | 0 |
| integrity | check:legacy-tables / check:legacy-program-rpcs / lint:architecture | 0 / 0 / 0 (pre-round) |
| integrity | `AUDIT_STRICT=1 npm run check:images` / image-widths (+self-test) | 0 / 0 (pre-round) |
| integrity | plan-hygiene self-test / workflow-artifact-policy (+self-test) / mojibake self-test / mojibake git grep | 0 / 0 / 0 / 0 (pre-round) |
| integrity | `npm run prove:entry-point` | **2**. NOT this slice: `scripts/check-event-rules-mirror.mjs` (ER-C3's file) uses isEntryPoint but is not in TARGETS of `scripts/prove-entry-point-dispatch.mjs`. Also red on this branch's base without my changes. C3 has not pushed a fix yet. Proposed patch for C3: add the script to TARGETS. |
| typecheck | check:rpc-typing / check:wallclock-brand | 0 / 0 |
| typecheck | `tsc -p tsconfig.app.json` (not a CI step) | 99 errors, all pre-existing in other files; 0 in `organiser/sessions` |
| unit | `TZ=Europe/London npm run test:unit:offline` | 1: 5 failures, all in `tests/integrityCouldNotRun.test.ts` (sandbox precondition: "typescript resolved in the temp repo"), red on the base too; 10338 passed |
| unit | test:unit:timing; tz-sensitive set under New_York and Sydney | 0 / 0 / 0 (pre-round) |
| unit | dancer-area-isolation (+self-test) | 0 (pre-round) |
| perf-budget | self-tests / `npm run build` / bundle-budget + first-load-requests + chunk-cycles | 0 / 0 / 0 |
| perf-budget | check:doc-weight | 1, sandbox: needs GITHUB_REPOSITORY and a preview URL |
| workflow-lint | docs-only self-test, masking, notification, no-preview-prefixes | 0 (pre-round) |
| seo | check:seo:self-test | 0 (pre-round) |
| ci-budget | check-ci-budget | 2, sandbox: needs the CI_BUDGET_GITHUB_TOKEN secret |
| db-contract (local part) | check-migration-stamps | 0 |
| lint | `npm run lint` | 0 with `bin/*.sh` executable (as in CI); 126 on check:integrity without the exec bit |

"pre-round" = run on the first fix version; later edits touched only `organiser/sessions/**` (re-tested in the full unit run and the build).

## Verified
- Every finding has a test; 26 were red on the unfixed code; full organiser suite 3580 passed.
- Prod row shapes (counts) are covered table-driven by `fromStored`/`toStored`.
- Production build and the perf budgets pass.

## Not verified
- 390x844 browser walk: no route mounts `SessionSheet` yet, so there is no screen to walk (the loader and saver wiring belongs to a later card).
- No end-to-end save: the server is not landed, and no caller passes stored rows yet.
- prove:entry-point (C3's script), doc-weight and ci-budget: see the table.
- No real phone.

## Next steps
- C3: add `check-event-rules-mirror.mjs` to the prove-entry-point TARGETS, and export `maxSessionMinutes`. Then switch `MAX_SESSION_MINUTES` to read it.
- The card that wires the sheet: build drafts with `fromStored(row, people)` and save with `toStored`.
