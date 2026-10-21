# ER-C7 handover: New event (rebuild)

Branch `claude/er-c7-new` from `claude/er-wave1`. Server NOT landed (AD1): `payment_methods`, the extended go-live check and `owner_create_venue_draft_v1` are built to ER-INTERFACE and faked in tests.

## Done
Steps (existing 6 routes, no new route): what (Weekly / One-off; Course OFF "Not available yet") -> name (creates draft) -> venue (C5 `VenuePicker`) -> first date -> `/time` = first session(s) (C4 `SessionSheet`, saved through `organiser_set_occurrence_programme_v1`, stored sessions marked removed so a return visit never doubles) -> `/cover` = flyer, How to pay (>=1 of 5 codes, ticket link asks for an address), optional description, live "How dancers will see it" preview (two panes at lg), **Publish** (live at once) and the quieter **Save as draft**. No start-time input, no category (a test and the shared ratchet check this).
Publish is disabled with the FIRST reason; both the local `eventRules` blockers and the server `series_go_live_check_v1` (read on the screen, and re-read after saving, before the lifecycle command) count. Untouched Save as draft sends nothing.
Files: `flows/new/{NewFlow.tsx, model.ts, goLiveCheck.ts, useNewSend.ts}`, tests `__tests__/NewFlow.test.tsx` (62 tests incl. 2 formats x 13 blocker rows).

## Edits outside `flows/new/**` (forced by the rebuild; each is a test line)
- `shared/__tests__/eventRules.nofield.test.ts`: removed the `flows/new/NewFlow.tsx` offender line (ratchet says do so).
- `__tests__/parity-matrix.test.ts`: dropped the `timeCommands` import and the C50 time row (the time step is gone).
- `__tests__/pseries.walk.test.ts`: removed the "last step" block testing deleted helpers `coverStepReason` / `offerLeave`.
- `__tests__/consistency.render.matrix.test.tsx`: venue conflict row types a search then taps a `VenuePicker` result.
- `shell/__tests__/routes.test.tsx`: `/time` and `/cover` pin `org-new-step`.

## Left / next
- Move `goLiveCheck.ts` to `shared/` once #897's file merges; confirm the real result shape (parked).
- Course, and "description required to go live" vs rule 11: server refuses (AD1 as built). Festival flow entry is C10.
- Browser walk and screenshots at 390x844.

## Verified on real data
Read-only survey, prod `stsdtacfauprzrdebmzg`, `event_series_p5` (counts): live 67 (recurring 44, one_off 10, course 6, festival 7; none without cover or venue; no ticket link 16), draft 2 (1 recurring without cover, 1 one_off), paused 2, ended 21 (recurring 13, course 8), archived 653 (one_off 635, 598 without venue). Shapes the screens are tested against: draft with no cover, no ticket link / no description, one_off and recurring formats, course/festival kept out of create.
## Phone QA (390x844)
NOT DONE: needs a signed-in organiser session and a running app with prod-shaped data; none in this sandbox. Tap targets are explicit px (44/48/56) and a source test checks every `min-h`.

## Checks (sandbox)
| Command | Exit |
|---|---|
| `npm run build` | 0 |
| `npx vitest run src/modules/organiser` (126 files, 3668 tests) | 0 |
| `npm run test:unit` | 1: 15 failures, all in `tests/eventViewCompat|occurrenceProgram|publicEventPageLineup.contract` (live DB, no network) and `tests/integrityCouldNotRun` (sandbox tooling); none touch this slice |
| `npm run lint` | 19 of 20 links pass; `check:integrity` 126 (no exec bit); `bash bin/check-integrity.sh` 0 |
| `npx eslint` on flows/new + edited tests | 0 |
| `npx tsc -p tsconfig.app.json` | pre-existing errors elsewhere; none in `flows/new` |
| `check:event-rules-mirror` | skipped (no admin copy path) |
Not run: e2e smoke, `check:og` (needs deploy).

## Not verified
Real RPC round trip (server not landed), phone walk, screenshots, that a draft's first date has an occurrence row on prod, the real go-live result shape.
