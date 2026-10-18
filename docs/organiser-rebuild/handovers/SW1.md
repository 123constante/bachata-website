# SW1 handover -- parity wave 1 (Website): series programme, line-up, cast, music chips, event organisers

- Ticket `dt_63c6a8fbcb6f`. Branch `claude/org-r1-parity-sw1`, cut from `claude/org-r1-integrate` @ 7d9751c.
- Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/SW1-series-programme.md` (blob 61cd537).
- Status: **DONE** for the Website slice. Every new write is behind `shared/parityGate.ts` `AW1_APPLIED = false` (the merge train flips it once AW1 is applied on prod).

## How the payloads were pinned (the admin repo was not reachable)

`123constante/bachata-admin-11april` is not in this session's access (add_repo refused). The brief says copy the payloads from the admin editor; instead they were read from the PROD function bodies (read-only SELECT on `stsdtacfauprzrdebmzg`, 2026-10-18), which are what the admin editor's save ends up calling:
- `_cmd_series_set_program_p5`: payload `{days:[{day_index, date_offset_days, label, sort_order, sections:[{kind, sort_order, label_override, items:[{title, type, start_time, end_time, room, venue_room_id, level_keys, style, theme, track_id, parallel_group_id, sort_order, people:[{profile_id, profile_type, role, level, sort}]}]}]}]}`. It DELETES the whole tree and re-inserts, so every field the editor does not touch is echoed from the stored row.
- `_cmd_series_set_organisers_p5`: `{organiser_ids: uuid[]}` (order kept, de-duplicated, ids must exist).
- Read: `_snapshot_series_p5` (inside `admin_event_workspace_p5`) returns `program: [{day, sections:[{section, items:[{item, people:[{profile_id, profile_type, role, level, sort_order, display_name, avatar_url}]}]}]}]`.
The prod bodies are the PRE-AW1 ones (admin-only guards); AW1 widens who may call them, not the shapes. **Not verified:** that AW1 keeps these shapes byte for byte, and `organiser_series_cast_v1` (does not exist on prod yet; its `{cast, recent_people}` shape is the brief's, parsed leniently: `profile_id`/`id`, `display_name`, `roles[]`).

## Done

| Brief item | What | Where |
|---|---|---|
| gate | `AW1_APPLIED = false` + `PARITY_GATE_REASON` "Needs the next platform update" | `shared/parityGate.ts` |
| commands | `AW1_COMMAND_KINDS`, `setProgramCommand` (additive; NOT in `OWNER_COMMAND_KINDS`, which mirrors the prod snapshot). `setOrganisersCommand` + `linkedOrganiserIds` live in `selfServeApi.ts`: the architecture lint bans the organiser list key everywhere else | `shared/seriesCommands.ts`, `shared/selfServeApi.ts` |
| 1 | Programme screen `events/ProgrammeSeries.tsx` (route `ORG_PATHS.eventProgramme`, row "Programme" on Details): Classes / Party sections, session rows (name, times, length, next-day marker, line-up with role words, level chips B IM IN AD OL), up/down, delete with in-page confirm, "Add a class / a party", ONE `series.set_program` with the complete tree. Session sheet `events/ProgrammeSheet.tsx`: type (new only), name, start/end + length, level chips, line-up with role (Teacher/DJ) and level per person, RECENT first, name search | `events/ProgrammeSeries.tsx`, `ProgrammeSheet.tsx`, `programmeSeriesModel.ts` |
| 2 | Cast row on Details (names + role words; empty state "Add a teacher to a class to show them here.") | `Details.tsx`, `programmeSeriesModel.ts` (`castOf`, `castLine`) |
| 3 | Music styles as chips (`?edit=music`): admin vocabulary + Urban Kiz + Cuban; stored spellings ("bachata", "sensualbachata") select their chip; a stored style with no chip stays; ONE `series.upsert default_music_styles`; untouched sends nothing | `events/MusicEdit.tsx`, `musicModel.ts` |
| 4 | Event organisers screen (route `eventOrganisers`, row "Organisers"): owner only (manager reads with the reason), "Link a page" (live pages only) and Remove, last one cannot be removed (off with the reason), ONE `series.set_organisers` | `events/SeriesOrganisers.tsx`, `organisersModel.ts` |
| 5 | Festival: read-only DAY tree with "Festival days are edited with the platform team for now."; course edits like a recurring series | `ProgrammeSeries.tsx` |
| 6 | "Differs on N dates" badge (coming, not-cancelled dates with a session override or an added session) with a link to each date's line-up (`ORG_PATHS.dateLineup`); per-date screens untouched | `ProgrammeSeries.tsx` |
| 7 | Parity matrix: C11, C12, C57 now PARTIAL (built behind the gate); C04 music now sends from `MusicEdit`; 5 new rows `SW1-programme / -lineup / -cast / -music / -organisers`; AW1 kinds pinned outside the prod owner mirror, tree/section/item/person key sets pinned to the writer; counts now match 45 / partial 11 / admin-only 8 / dropped 7 | `__tests__/parity-matrix.test.ts` |

Other edits: `EventWorkspace` gained `program` and `organiserIds` (additive); `ORG_PATHS` + routes for the two screens; `s5.events.test` no longer lists `music` among the text fields (it is chips now); `focusReturn.test` lists the two new `SheetView` call sites; `paths.test` pins the two paths.

## Decisions (with reasons)

1. **Cast row reads the workspace tree, not `organiser_series_cast_v1`.** The tree is already loaded and is the same data the rows show, so one fact reads one way on every screen; the RPC is used ONLY for `recent_people` (the picker's RECENT list), and only when `AW1_APPLIED` (it does not exist on prod today).
2. **"Differs on N dates" is one badge for the screen, not one per session.** The workspace read carries per-date COUNTS of session overrides, not which session; a per-session badge would be a guess.
3. **"Link a page", not "Add an organiser".** `consistency.matrix` forbids the words "Add an/another organiser" (owner naming decision: "Add a page" is the add-your-own-page screen).
4. **Empty sections are not sent.** A section with no sessions is dropped from the tree (untouched trees round-trip identically because both sides go through the same builder).
5. **Level and role words come from `shared/programmeModel` (`LEVEL_LABEL`, `PEOPLE_ROLE_LABEL`)**; the compact chips B/IM/IN/AD/OL are one table (`LEVEL_SHORT`) used by the row, the sheet and the legend; the full word is the accessible name.
6. **A person's `level`** is any of the five level keys or none (prod: 8 of 284 people rows carry one: beginner 3, improver 3, intermediate 2).
7. **Social section kind shows as "Party"** (`check:no-social-word`).
8. **Viewer role** comes from `organiser_home_v1` (owner if any organiser they own runs the series), so no extra read.

## Prod survey (read-only SELECT, counts only, 2026-10-18)

Series by format x lifecycle (organiser count; days / sections / items / people): live one-off 10 (1 org; 10/17/24/16), live recurring 39 (1 org; 39/73/132/72) + 5 (2 orgs; 5/11/18/20), live course 6, live festival 7 (30 days, 76 people), ended recurring 11 + 1 (2 orgs), ended course 8, draft recurring 6 (1 day, 2 sections, 2 items), paused recurring 1; archived 650+ (564 one-off with 0 organisers). Organiser counts: 0 on archived history only; 1 on every live/ended/draft series but 5 live recurring and 1 ended recurring with 2. Section kinds: party 425, classes 132, masterclass 12, showcase 3, competition 3, social 2. Item types: party 365, class 272, masterclass 19, performance 2, workshop 2, show 1, competition 1 (so a stored type outside class/masterclass/party/performance is kept as stored). People: teacher 204, dj 79, dancer 1; roles teaching 203, djing 79, performing 1, mc 1. Music values are mixed case (bachata 55 / Bachata 52 / sensual bachata 27 / Sensual Bachata 25 / Salsa+salsa 34 / ...).

## Red-first evidence

1. The new render tests against the UNFIXED `Details.tsx` (new files present):
```
 Tests  4 failed | 41 passed (45)
   -> Unable to find an element by: [data-testid="org-detail-programme"]   (x2)
   -> Unable to find an element by: [data-testid="org-detail-cast-line"]
   -> Unable to find an element by: [data-testid="org-music-chip"]
```
2. Before the build, the existing matrix failed on the old rows (these rows asserted nothing sent `series.set_program` / `series.set_organisers`):
```
 FAIL parity-matrix > 'C11' ... the owner allowlist has no series.set_organisers, and nothing here sends it
 FAIL parity-matrix > 'C12' / 'C57' ... the owner allowlist has no series.set_program, and nothing here sends it
 FAIL s5.events > C37 details > 'music'      FAIL paths.test > is the pinned table
 FAIL focusReturn > events/ProgrammeSheet.tsx passes returnFocusRef    FAIL consistency.matrix > D22 (StatusTag import), "Add an organiser"
```
3. **Mutation proving a matrix row can fail** (removed the AW1 gate read from `organisersModel.ts`, then restored):
```
 FAIL parity-matrix > 'C11' 'Co-organisers on the event' ('PARTIAL') > organisersCommand( builds exactly its kind and keys ...
 FAIL parity-matrix > 'SW1-organisers' ... > organisersCommand( builds exactly its kind and keys ...
 AssertionError: events/organisersModel.ts gates on A1 / AW1: expected '// The event's organisers (parity wa…' to match /\bA(W)?1_APPLIED\b/
 Tests  2 failed | 316 passed (318)
```

## Consistency matrix

`events/__tests__/sw1.parity.test.tsx` (45 tests) + the pinned matrix: pure rules; `programmeOff` x (gate on/off, format recurring/course/one_off/festival, lifecycle live/draft/ended/archived, viewer can/cannot write); render x (one-off/recurring/course/draft x 0/1/3 sessions, with/without line-up, gate off); festival; ended; differs badge; gate on: untouched Save sends nothing, rename sends ONE command with room/style echoed, reorder+delete (no browser confirm), add a class with RECENT teacher with role and level, search, invalid new session keeps Save off; organisers: gate off, manager, last-one, owner link/remove. Every control >= 44px (`tooSmall`).

## CI, every job step run in the sandbox

| Job | Command | Exit |
|---|---|---|
| typecheck | `npm run check:rpc-typing` / `check:wallclock-brand` | 0 / 0 |
| typecheck (not gating) | `tsc -p tsconfig.app.json`, organiser module | 1 pre-existing only (`edit-in-place/__tests__/TeamPicker.test.tsx:297`) |
| architecture-guard | `bash bin/check-integrity.sh` | 0 |
| architecture-guard | `check:legacy-tables` / `check:legacy-program-rpcs` / `lint:architecture` | 0 / 0 / 0 (first run 1: the organiser list key outside `selfServeApi.ts`, fixed) |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images` | 0 |
| lint chain | `npm run lint` | 0 (20/20; first run 1: `check:no-social-word`, fixed) |
| unit-tests | `npm run test:unit` | 1: the same 15 sandbox-only failures as P-SERIES (`eventViewCompat` / `occurrenceProgram` / `publicEventPageLineup` live-DB contracts, `integrityCouldNotRun`); 397 files pass. `src/modules/organiser` + `tests/regression`: 121 files, 3807 passed |
| perf-budget | `npm run build` (PRODUCTION, `VITE_ENABLE_ORGANISER_SELF_SERVE=true`) | 0 |
| perf-budget | `check:first-load-requests` / `check:chunk-cycles` | 0 / 0 |
| perf-budget | `check:bundle-budget` | **1, identical on the BASE** (`claude/org-r1-integrate` rebuilt and measured): dancer-app 364.2 KB vs 364, chunk ratchet auth 34 vs 33 and dancer-app 59 vs 58. Not from this slice (the organiser chunks are lazy); with this slice dancer-app reads 364.4 KB. Needs the owner's call on the allowances |
| e2e-smoke | `npm run test:e2e` | 0 (158 passed, 1 skipped) |
| walk | `tests/e2e/walk-sw1.spec.ts` at 390x844 (gate off: shipped build; gate on: throwaway build) | 0 / 0, shots in `docs/organiser-rebuild/walk-SW1/` |

## Verified / Not verified

**Verified:** the payload and read shapes against the PROD function bodies (read this session); the prod shape survey; the 45 new tests + the matrix (318) + the whole organiser module and regression suite; every CI step above; a production build; a 390x844 walk of the Details rows, music chips, programme (gate off, gate on), festival, organisers, session sheet, RECENT search and delete confirm on prod-shaped data (route-mocked); tap targets via `tooSmall`.

**Not verified:**
- Nothing was sent to prod or the E2E project; commands are verified by shape against the prod writers, not by a live call. The prod writers are still admin-only until AW1 is applied, so a live save was not possible by design.
- `organiser_series_cast_v1` does not exist on prod yet; its response shape is the brief's.
- No real phone; the walk uses a route-mocked fake (prod-SHAPED, not prod rows). Real people names and photos not seen.
- The 100-row API cap case: the workspace read holds the newest 100 dates, so "differs on N dates" counts only those (a series with more than 100 listed dates could under-count).
- The architecture and perf allowances above (pre-existing red) and `/code-review` (the owner types it) were not touched or run.
- A line-up person added from RECENT as a role the person does not hold: the server's own rules decide (AW1).

## Left / next steps for the merge train

1. After AW1 is applied on prod: flip `AW1_APPLIED` to `true` in `shared/parityGate.ts` (nothing else), re-run `parity-matrix`, then do one real save of each kind on the E2E project and a phone check.
2. Decide the `check:bundle-budget` allowances (pre-existing red on the base).
