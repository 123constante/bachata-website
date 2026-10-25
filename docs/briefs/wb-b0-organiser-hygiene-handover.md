# Wave B0 (Website) handover: organiser hygiene after admin waves A1-A5

Brief: `docs/briefs/wb-b0-organiser-hygiene.md` (branch `brief/wb-b0-hygiene`, sha 1e6099c5).
Branch: `claude/wb-b0-organiser-hygiene` (from main dd85bf8). Ticket dt_ee96822e62c0.
Lane: NORMAL, Website only, NO database change.

## Status

| item | result |
|---|---|
| 1. move the `series.remove_date` callers | DONE: `savePlan` now sends `occurrence.move_date` and never a remove. No organiser code mentions `series.remove_date` any more except the server allowlist mirror, and a static test pins that. Admin can lock `series.remove_date` for owners in a later wave. |
| 2. friendly refusal text | DONE: 25 server messages from A1, A2 and A3, plus the `move_date` refusals, each map to one plain sentence. |
| 3. venue chooser `city_id` | NOT BUILT, **needs admin RPC change** (see below). Code left as it is. |

## Caller trace (Website main dd85bf8, before this branch)

| token | file:line | live? | what it was | now |
|---|---|---|---|---|
| `series.remove_date` (builder `removeDateCommand`) | `src/modules/organiser/shared/seriesCommands.ts:248` | builder | `{kind:'series.remove_date', payload:{occurrence_id}}` | builder deleted; `moveDateStep` added |
| `removeDateCommand(old.id)` | `src/modules/organiser/events/eventModel.ts:236` (`savePlan`, one date -> weekly from a new start) | **no live caller**: `savePlan` is called only by tests (see note) | set_recurrence, then remove the old off-rule date | move the old date onto the new start FIRST, then set_recurrence |
| `removeDateCommand(old.id)` | `src/modules/organiser/events/eventModel.ts:248` (`savePlan`, one date moved) | same | add the new date, then remove the old | the date MOVES; a past or cancelled date stays and the new date is added; a day that is already taken gets neither |
| `series.remove_date` | `seriesCommands.ts:15` `OWNER_COMMAND_KINDS` | mirror only | server allowlist mirror (pinned by the mirror test) | unchanged until admin locks the kind; then drop it from the mirror |
| `'remove_date'` | `src/modules/organiser/shared/editorGuards.ts:50,89` | confirm-copy kind only, sends nothing | a `ConfirmKind` string | unchanged (no command) |
| `_cmd_series_remove_date_p5` | `src/integrations/supabase/types.ts:7937` | generated types | n/a | unchanged |
| `removeDate` (camel case) | none outside the builder | - | - | - |
| `city_follows_venue` / `slug_admin_only` / `category_admin_only` | none (fell through to the generic "You cannot make that change here") | - | - | `selfServeErrors.ts` `COMMAND_COPY` |
| `moveDateCommand` | `seriesCommands.ts:261` | had no caller | - | used by `moveDateStep` |

**Note on `savePlan`:** a grep of the whole repo finds no production importer of `savePlan`. Only
`events/__tests__/*` call it. The rebuilt editor flows (`flows/event/EventStep.tsx` and others) send
their own commands, and none of them sends `series.remove_date`. So today no live organiser journey
sends `series.remove_date` at all. The admin lock is safe as far as the Website is concerned, but
re-check this trace on the day it is applied.

## What changed

- `seriesCommands.ts`: deleted `removeDateCommand`. Added `DateStep` (an `OwnerCommand` plus
  `occurrence: {id, version}`) and `moveDateStep(date, toDate)`.
- `eventModel.ts` `savePlan`: returns `Array<OwnerCommand | DateStep>`.
  - One date moved: the date moves with `occurrence.move_date` against the date's own version.
  - The old date is past or cancelled (it cannot move): `series.add_date`, and the old date stays
    as history.
  - The new day already holds a date of the event, cancelled ones included (the server refuses
    with `date_taken`): no date command is sent.
  - One date -> weekly from a new start that is off the rule's path: the move goes BEFORE
    `set_recurrence`. The move puts the old day into `removed_dates` (prod
    `_cmd_occurrence_move_date_p5`), so the rule does not bring it back.
- `runCommands.ts` `useRunCommands`: a `DateStep` goes through `occurrence_command_p5` against the
  date's version.
  - Prod `_cmd_occurrence_move_date_p5` bumps the SERIES version too (`version = version + 1`).
    So before the next series command, and before returning, the runner re-reads the series version
    (`admin_event_workspace_p5`).
  - The runner-only `occurrence` field is never sent.
- `selfServeErrors.ts` `COMMAND_COPY`: new rules, anchored and placed before the loose rules.
  - A1: `city_follows_venue`, `slug_admin_only`, `category_admin_only`.
  - A2: `forward_from_past`, `format_festival_admin_only`, `format_needs_collapse`,
    `format_course_needs_rule`, `course_total_needs_course`, `collapse_needs_repeating`,
    `collapse_survivor_past`, "on an ended series is admin-only", the `series.set_group_chat` url.
  - A3: `occurrence_cancelled`, and the date title / music_styles / gallery / passes value rules.
  - `move_date`: `date_taken`, "needs a scheduled date", festivals, `to_date required`.
  - `date_cap` already had text.
  - Every line says what the person can do next: ask the team, pick, choose, enter, leave empty,
    put the date back, or reload.

## Item 3: needs admin RPC change

The chooser reads `get_organiser_venue_options_v1` (`shared/publicVenues.ts:20`). The prod body,
read-only, is
`jsonb_build_object('id','name','neighbourhood','city_name','address','postcode')`. It has NO
`city_id`. The public fallback `get_public_venues_list_v4` does not have it either. So the Website
still resolves the city by NAME (`shared/createCity.ts`), and the create flow keeps the organiser-city
fallback.

**Ask for admin:** add `'city_id', e2.city_id` to `get_organiser_venue_options_v1` (additive). Then
on the Website:
1. add `city_id` to `VenueOption`;
2. send `venue.city_id` from `flows/new/NewFlow.tsx:183`, `events/Details.tsx:142` and
   `dates/venueOverride.ts:17`;
3. drop the organiser-city fallback in `createCity.ts`.

Prod today: 67 venues, 0 without a city, so the fallback never fires yet.

## Overlap with open Website PRs

Checked with the GitHub MCP list (gh unavailable):

- **#1032** (`claude/er-c8-eventpage`) touches `events/eventModel.ts`, `shared/selfServeErrors.ts`
  and `shared/seriesCommands.ts`, in other regions (payment methods, detail fields, its own copy
  rows). `git merge-tree` of this head against #1032's head is clean, with no conflict. I could not
  narrow this change further, because those three files are exactly what the brief targets.
- **#1033-#1036**: no file overlap.
- The many docs-only PRs: no file overlap.

## Real-data shape survey (prod, read-only, counts)

- one_off: 337 archived with 1 past date, 298 archived with 0 dates, 11 live with 1 date
  (10 past, 1 upcoming), 1 draft with 1 upcoming, 1 paused with 1 upcoming.
- Recurring with no rule: 1 draft with 0 dates, 9 live with 2+ dates (fixed mode, savePlan sends no
  date command), 13 ended.
- Recurring with a rule: 35 live, 1 paused, 1 draft (weekly mode).
- 15 series carry `removed_dates`.
- Venues: 67, all with a city.
- The matrix covers each date shape savePlan can meet in single mode:
  - future scheduled;
  - past;
  - cancelled;
  - an added date already on the new day;
  - a cancelled date on the new day;
  - recurring with one date, and one date -> weekly (off the weekday, a later start on the same
    weekday, the same start, a cancelled old date);
  - untouched (sends nothing).

## Tests (red first)

- `events/__tests__/moveNotRemove.matrix.test.ts` (new): 7 of 17 red on the unfixed code. The other
  10 are untouched-sends-nothing rows and rows the old code already got right.
- `shared/__tests__/selfServeErrors.waveB0.test.ts` (new): 25 of 26 red on the unfixed map. Each
  row checks that the message:
  - maps to its own sentence;
  - is not a catch-all;
  - shows no raw code or key;
  - names a next step.
- `shared/__tests__/runCommands.test.tsx`: +2. A DateStep is routed to `occurrence_command_p5` on
  the date's version, and the series version is re-read after it.
- Updated: `eventModel.test.ts`, `fixesBatch.matrix.test.ts` and `seriesCommands.test.ts` asserted
  the old remove.

## Walk at 390x844 (orchestrator, after the push)

This is wording-only on screen. The move path has no live screen (savePlan has no caller), so the
walk is the error text. With a prod-shaped organiser session, mock the RPC answer with devtools /
Playwright `page.route` on `/rest/v1/rpc/series_command_p5` and `/occurrence_command_p5`,
returning 400 `{code:'P0001', message:<server text>}`:

1. `/organiser` -> an event -> Details -> Venue -> pick another venue -> Save. Mock
   `permission_denied: city_follows_venue: ...`. Expect "The city comes from the venue...". It must
   fit at 390 wide with no truncation.
2. Same screen, mock `permission_denied: category_admin_only: ...`. Expect "That kind of event
   cannot be set here...".
3. Dates -> a cancelled date -> any per-date change. Mock `permission_denied: occurrence_cancelled:
   ...`. Expect the "Put the date back first" line, and check that the put-back control IS on that
   screen.
4. Dates -> Change -> move a date (bulk shift). Mock `invalid_transition: date_taken: ...`. Expect
   "already has a date on that day".
5. Each of these: the message wraps inside the sheet, and the save bar stays usable.

## Gates

Every PR-triggered CI step run in the sandbox on 252ed69 (HEAD^1 = origin/main). No failure is
caused by this branch.

| workflow / job | result |
|---|---|
| typecheck (rpc-typing, wallclock-brand) | pass |
| unit-tests: test:unit | the 6 changed organiser files pass (113 tests). 19 of 597 files fail in the sandbox: 4 contract files hit the sandbox DB ("Invalid API key", not prod); the other 15 fail the same way on origin/main, or pass when run alone (load flakes) |
| unit-tests: timing, New_York / Sydney tz legs, dancer-area isolation | pass |
| architecture-guard: integrity (check-integrity, legacy guards, lint:architecture, check:images AUDIT_STRICT=1, widths, plan-hygiene, artifact policy, mojibake, entry-point, going-legacy) | pass |
| e2e-smoke: test:e2e | 146 pass. 2 fail, identically on origin/main: organiser-home.spec.ts:55 and organiser-layout.spec.ts:171 |
| perf-budget: canaries, build, bundle budget, first-load requests, chunk cycles | pass (lighthouse is skipped for `claude/*`) |
| workflow-lint (bom, masking, notification) | pass |
| db-contract-check: gate, migration stamps, rollover, script conventions | pass. The live checks are env-blocked: the sandbox key is not prod, and no contract script imports the changed files |
| phone-qa: phone suite (348 pass) and build-smoke (73 pass) | pass |
| phone-qa-section | needs the `## Phone QA` section in the PR body (added) |
| types-drift, seo, og, synthetic, live-qa, prod-smoke | skipped: path filter, or preview / prod only |
| `npm run typecheck` | 95 errors on the branch, 95 on main, none in the changed files |
| eslint on the changed files | 0 errors |

## Left / next steps

1. Admin: add `city_id` to `get_organiser_venue_options_v1`, then the 3-step Website follow-up above.
2. Admin: lock `series.remove_date` for owners. Then drop it from `OWNER_COMMAND_KINDS` (the
   static test in `moveNotRemove.matrix.test.ts` will then need its expectation changed to `[]`).
3. If a screen ever calls `savePlan` again, it must run through `useRunCommands` (which routes
   DateSteps), never straight through `runSeriesCommand`.

## Phone render check (follow-up job dt_b321152e059f)

Spec: `tests/e2e-phone/organiser-refusal-copy.phone.spec.ts` (phone suite, runs in `phone-qa.yml`).
Real component: the change flow's "Take this date off" step (`flows/change/TakeOff.tsx`, `change-error-message`,
button `change-off-confirm`), reached at `/account/o/change/:series/:date/off` with the go-live fake Supabase
and `series_command_p5` answered with a P0001 refusal carrying each row's server text.

- Rows come from the exported `COMMAND_COPY` (a sample server message is built from each row's pattern and must
  map back to that row through `commandErrorMessage`, or the spec throws). 57 distinct sentences covered by the
  count assertion (>= 25; includes the 25 wave B0 lines); the version-conflict row is skipped (its own screen).
- Per sentence, at 390x844 and 360x640: note box not wider than itself (scrollWidth), no sideways page scroll,
  no ellipsis, no clipping ancestor, note inside the viewport, confirm button >= 44 px tall, inside the viewport,
  and the element at its centre (elementFromPoint); text contrast >= 4.5:1 against the composited background.
- Red first: before the fix the longest title row (80-character title with no spaces) overflowed its box
  (735 px of text in a 338 px box at 390 wide). Fix: `break-words` on the four `change-error-message` lines
  (TakeOff, Copy, Pick, parts). After the fix all 56 checked sentences pass at both widths.
- A second probe (a 400-character message) was tried, but it went through the real mapping and became the generic
  sentence, so it proved nothing about layout; the real overflow failure above is the red evidence.
- NOT verified: other screens that show these sentences (Details city error, DateSheet cancel/uncancel, NewFlow,
  CoverFlow) are not rendered by this spec; they share the same text style but are not measured. Chromium only,
  no safe-area inset, no real device.
