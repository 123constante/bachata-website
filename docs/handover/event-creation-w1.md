# Handover: event-creation W1 (Website) — New event page = name + four format cards

Branch `claude/event-creation-w1` (from `main` at 4a63921, after #750). Bot PR #758. Brief:
`briefs/event-creation-w1.md` on `arc/briefs-event-creation`.

## What changed

- `src/modules/organiser/events/eventType.ts` (create side only: the old chip table and `chipHint`):
  `EVENT_TYPES` / `chipHint` / `FIRST_SESSION_HINT` / `CHIPS_LOCKED_HINT` / `NewEventType` become
  `FORMAT_CARDS` / `formatHint` / `FORMAT_HINT` / `FORMAT_LOCKED_HINT` / `NewEventFormat`, plus
  `FormatCardId`, `TEAM_SETS_UP`, `isNewEventFormat`, `SELECTABLE_FORMATS`. `SEED_SESSION` and
  `DEFAULT_DURATION_MINUTES` (create-side, only the seed used them) are deleted. The editor Type row
  parts (`TypeRowState`, `typeSublabel`, `EVERY_UPCOMING_CANCELLED`, `noDateSentence`) are byte-untouched, so W3 still owns them.
- `newEvent.ts`: `newEventCommands(..., format)` sends `format` (one_off | recurring) and no category.
  One-off schedule = `series.add_date` (one date, today+7, as before); Recurring = `series.set_recurrence`
  weekly on that date's weekday, open-ended (the same rule `createModel.followUpCommands` sends).
  `seedSessions`, `listedOccurrenceId` deleted. New `duplicateNamed` (d32) and `NEW_EVENT_DURATION_MINUTES` (120).
- `NewEventPage.tsx`: the "First session" chips are replaced by a `Format` section: four cards in a 2x2 grid
  (One-off, Recurring selectable; Course, Festival disabled, each showing "Ask the Bachata Calendar team to set
  this up."). A quiet duplicate note sits under the name with an "Open it" link; it never disables Create.
  The seeding step after the schedule is removed (W2 adds sessions on the draft).

### Fix-1..7 behaviour: what was kept, and what changed because the chips went
Kept: the lost-reply freeze (name, cards, organiser), the identical resend under the same create key, the
refusal-only reopen rule (`reopensAfterFailedCreate`), the city lookup failure message, the blocked-organiser
exit sentence, the fixed hint box, Open below Create.
Changed only because the chips went:
- The validation message is now "Choose One-off or Recurring." It used to ask for a class, party or workshop.
- The schedule failure now says "its weekly dates were not listed" for Recurring. One-off still says "its date was not listed".
- The third step (seeding the first session) is gone, and so is its "first session was not added" error.
- `SentCreate.type` is now `SentCreate.format`.

### New logic (lines a reviewer should read)
- `newEvent.ts` `newEventCommands`: the `format` override on the draft and the schedule ternary.
- `newEvent.ts` `duplicateNamed`: live/paused filter, trim + lowercase compare, deterministic pick.
- `eventType.ts` `isNewEventFormat`, `FORMAT_CARDS`, `formatHint` open-phase fallback.
- `NewEventPage.tsx` `FormatCards` (the selected state is aria-pressed only. There is no colour transition, and the focus ring shows for keyboard focus only), the `duplicate` line, and the schedule error's `what`.

## Shape survey (prod `stsdtacfauprzrdebmzg`, read-only, counts only)
- **format x lifecycle:**
  - one_off: live 9, archived 70
  - recurring: live 49, paused 1, draft 5, ended 13, archived 7
  - course: live 6, ended 8, archived 1
  - festival: live 7, archived 3
- **Duplicate names:** 2 organiser groups already hold a live or paused name twice, so the note picks one deterministically. No duplicate differs only by case.
- **Series per organiser:** at most 45.

## Checks (local, on 313e4f9 unless noted)

| Command | Exit | Note |
|---|---|---|
| `npx vitest run src/modules/organiser/events/__tests__/newEventFormat.matrix.test.tsx` | 0 | 38 tests |
| same file on `main` (red-first) | 1 | fails at collection: the format cards do not exist on main |
| 10 mutants (scratch worktree, `mutants.py`) | all KILLED | see below |
| `npx vitest run src/modules/organiser` (subagent) | 0 | 82 files, 3175 tests |
| `npm run test:unit` | 1 | 15 env-only reds in 4 files; the SAME 15 fail on `main`: `eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup` are live-DB contracts, and `integrityCouldNotRun` (fixture depends on linked worktrees/env) |
| `npm run lint` | 0 | |
| `bin/check-integrity.sh` | 0 | |
| `npm run check:legacy-tables` / `check:legacy-program-rpcs` | 0 / 0 | |
| `npm run lint:architecture` | 0 | |
| `AUDIT_STRICT=1 npm run check:images` | 0 | |
| `npm run check:rpc-typing` / `check:wallclock-brand` | 0 / 0 | |
| `npm run build` (production) | 0 | |
| `check:bundle-budget` / `check:first-load-requests` / `check:chunk-cycles` (+ self-tests) | 0 | no budget, pin or vendor-ui list touched |
| `node scripts/lint-workflow-masking.mjs`, `check-migration-stamps.mjs`, `check:plan-hygiene:self-test` | 0 | |
| `tsc -p tsconfig.app.json` | pre-existing errors only | nothing new under `src/modules/organiser` or `tests` |
| `npm run test:e2e` (CI placeholder env, full gate) | 1 | dev server cold start timed out at 120s (environment, before any test ran); CI `e2e-smoke` is the gate |
| `npx playwright test organiser-events organiser-loop` (CI placeholder env) | 0 | 12 passed: the gate specs this branch edited |

Mutants (each must red the matrix):
- M1: duplicate check ignores lifecycle
- M2: Course selectable
- M3: Recurring sends one date
- M4: card colour transition
- M5: duplicate disables Create
- M6: format not sent
- M7: no reason on a disabled card
- M8: draft counts as a duplicate
- M9: lost reply unfreezes
- M10: `focus:` ring instead of `focus-visible:`

All 10 were killed.

## Browser walk
390x844 against the PRODUCTION build: `react-router build` with the e2e placeholder env, served by
`@react-router/node`. Data came from the Playwright organiser fake (`tests/e2e/helpers/organiserFake.ts`).
- Course and Festival are disabled and show the reason.
- Typing "friday BACHATA" shows the duplicate note with Open it (44px tall).
- Picking One-off then Recurring leaves exactly one pressed card. After 500ms, One-off's border is back to grey, with no box-shadow.
- Every card is 56px tall, and there is no horizontal scroll.
- Create lands on the new event's editor.

## Verified / Not verified
- **Verified:**
  - The new rules are red-first against main and mutation-proven.
  - The matrix covers 4 cards x {selectable, disabled+reason} x {name empty, duplicate, unique} x {online, lost reply, refused, city lookup fail}.
  - The no-secret CI steps above.
  - The production-build walk at 390x844 on fake data shaped like prod.
- **NOT verified:**
  - The walk did not run on the branch database `ozdodfwhlxpxgtqhaewa`: this worker has no organiser login there.
  - Not tested on a real phone.
  - The real server's answer to `series.set_recurrence` straight after a non-admin create was not exercised live, only through the fake and the unit envelope.
  - CI results on GitHub: see the PR checks.
