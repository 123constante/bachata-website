# P-SERIES handover -- parity fix pass, the event as a whole (PARTIAL)

- Ticket `dt_aa066898fa0b`. Branch `claude/org-r1-parity-series`, cut from `claude/org-r1-integrate` @ e04dea0.
- Brief: `arc/briefs-organiser-r1:docs/organiser-rebuild/briefs/P-SERIES.md` (blob fb52b30).
- Status: **PARTIAL** -- items 1-8 built and green; item 9 (the parity matrix test) NOT started (context rule: the worker reached 25% before it). One push.

## Done (audit row ids)

| Row | What | Where |
|---|---|---|
| C28b | Draft: "Go live" on One event, OFF with the reason. A1 off -> "Needs the next platform update. Before then, add a venue and a cover picture." (missing items named); A1 on -> the missing items alone, or the button (ONE `set_lifecycle live`). | `events/LifecycleActions.tsx` (mounted by ONE line + its import in `events/OneEvent.tsx`), `events/lifecycleModel.ts` |
| C28a | Wizard last step: with `A1_APPLIED=false` the button reads "Save as draft", sends NOTHING, Done says "Saved as a draft. Going live needs the next platform update."; the step shows the same note. A1 on -> unchanged Go live. | `flows/new/model.ts` (`liveCommands(a1)`, `finishLabel`), `flows/new/NewFlow.tsx` |
| C28b (Home) | `stale_draft` already led to One event; One event now has Go live / Discard for a draft, so the Home job leads somewhere that can act. | (no change to `homeJobs.ts` PROBLEM_TO needed) |
| C30b | "Discard draft" -> in-page confirm ("Discard this draft? It leaves your events. Dancers never saw it." / Keep it) -> ONE `set_lifecycle archived`. | `events/LifecycleActions.tsx` |
| C38 | "See it live" (public page, `publicEventPath`, new tab) on One event and on Done when the flow names an event; draft: shown off with "Dancers can see it once it is live"; paused/ended/archived: not shown. | `LifecycleActions.tsx`, `flows/Done.tsx` |
| C69 | "Show your WhatsApp" Home step and its `JobKind` deleted. | `jobs/homeJobs.ts` |
| C06 | Details rows "Gallery" (N photos / Add) and "Videos" open the existing sheets; Add photos uploads through `uploadEventPicture` (flyer pipeline: checked, re-encoded); closing the sheet sends ONE upsert `default_gallery` or `default_video_urls` only when the list changed. | `events/Details.tsx`, `events/seriesExtras.ts` (`mediaCommand`) |
| C16 | Stop repeating: "Which is the last date?" (each coming date); default = the last one (keeps all, as before); ONE `stop_repeating` keeping the dates up to the choice; the line says how many stay / come off. | `flows/event/EventStep.tsx` |
| C40 | "Make it weekly" row for `format='recurring'` + no rule + not closed: weekday (default the next date's) + "Listed until" choices within 30 coming dates (`allowedEndChoices`) -> ONE `set_recurrence` (`weeklyUntilCommand`). | `flows/event/eventSteps.ts`, `EventStep.tsx` |
| C14 | Details row "Ends" -> `?edit=ends`: end time, an end at or before the start = next morning, max 20 h (server bound 1-1200 min) -> ONE upsert `default_duration_minutes`. | `events/DetailsExtras.tsx` (`EndEdit`), `seriesExtras.ts` |
| C09b | Details row "Prices" -> `?edit=prices`: rows of name + price + currency (GBP/EUR/USD), add/remove, up to 10; empty state "No prices yet. Add a price so dancers know what entry costs."; ONE upsert `default_passes` with the owner keys only (id uuid, name, price number|null, currency). A list the team set up is shown OFF with "This price list was set up by the Bachata Calendar team, so it can't be changed here." | `DetailsExtras.tsx` (`PricesEdit`), `seriesExtras.ts` |
| pinned | `shared/a1Gate.ts` created byte-exact from the brief. | |

Tests: `src/modules/organiser/__tests__/pseries.parity.test.tsx` (16 render tests); existing tests updated for C69 (`homeJobs.matrix`, `HomeR1`, `Door`, the `account.today` snapshot: 4 lines `button "Show your WhatsApp"` removed) and for Done now reading the event (`flows/__tests__/Done.test.tsx` wraps a QueryClient).

## Decisions (with reasons, for the review pack)

1. **No "how many" on prices.** Prod `_owner_passes_problem_p5` (read 2026-10-17) allows ONLY `id, name, price, currency, description` per entry, max 10, id a uuid, price a number (<= 6 digits, 2 decimals) or null. `quantity` would be refused. Built name + price + currency.
2. **Team-made price lists are read-only here.** All 3 live series with passes (and 4 archived) fail that owner check (they carry tier/type/quantity/covers_days...). Offering Save would always fail, so the row is off with the reason.
3. **C14 copy differs from the brief's suggested line** -- verified on prod as the brief asked. `_cmd_series_upsert_p5` re-times coming dates ONLY when the START time changes (lines 319-359); a duration-only change re-times nothing; `_materialise_series_occurrences_p5_v1` uses `default_duration` for NEW dates. So "Every coming date keeps this length" would be false. Shipped: "Dates added from now on end at this time. Dates already listed keep their times; to change one, open it from Coming dates."
4. **Go-live checklist is client-side.** `event_publish_readiness_v1` checks name, venue, city, start date, organiser -- not cover or a date still to come. `goLiveMissing` checks name, venue, a date from today on, a cover. City is not read (the workspace parser in read-only `shared/seriesModel.ts` drops `default_city_id`; Details always sends the city with the venue); the server still refuses a missing city with its own message.
5. **C16 uses `stop_repeating` keep-list, not `set_recurrence until`.** With an old rule, `_reconcile_series_occurrences_after_rule_change_p5_v1` prunes every unbooked date off the new rule after today; the keep-list is the explicit, already-used path and says exactly which dates stay.
6. **C40 is safe for listed dates.** The reconcile prune runs only when the OLD rule is non-null; these series have none, so every listed date stays. Prod shapes of the 9: 5 with 0 coming dates, 3 with 1, 1 with 3.
7. New files beyond the brief's list (all new, none owned by P-DATES): `events/lifecycleModel.ts`, `events/seriesExtras.ts`, `events/DetailsExtras.tsx`. `OneEvent.tsx` got the mount line AND its import line (one line is not possible).
8. Wizard cover step hides "Save as draft and leave" while A1 is off (the main button already saves the draft; two buttons saying the same thing).

## Prod survey (read-only SELECT, counts only, 2026-10-17)

drafts 6 (4 older than 7 days, 5 without a cover); live 67; live with gallery 15, with videos 14, with passes 3 (owner-writable: 0); live `recurring` without a rule 9; live with a stored duration 67. Pass keys seen: covers_days, currency, description, early_bird_price, id, name, price (number 46 / string 1), quantity (number 4 / string 14), sales_end, sales_start, tier, type, visible; max 17 per series.

## Red-first evidence (the new test against the unfixed code)

```
 Test Files  1 failed (1)
      Tests  15 failed | 1 passed (16)
     -> Unable to find an element by: [data-testid="org-life-golive"]
     -> Unable to find an element by: [data-testid="org-life-discard"]
     -> Unable to find an element by: [data-testid="org-life-discard"]
     -> Unable to find an element by: [data-testid="org-life-seelive"]
     -> expected [ 'New event', 'Add a photo', ...(2) ] to not include 'Show your WhatsApp'
     -> Unable to find an element by: [data-testid="org-detail-gallery"]   (x3)
     -> Unable to find an element by: [data-testid="org-detail-videos"]
     -> Unable to find an element by: [data-testid="org-detail-ends"]      (x2)
     -> Unable to find an element by: [data-testid="org-detail-prices"]    (x2)
     -> Unable to find an element by: [data-testid="event-stop-last"]
     -> Unable to find an element by: [data-testid="org-event-weekly"]
```
(The 1 pass: "a weekly event with a rule has no Make it weekly" -- a negative that is true before and after.) After: 16/16 pass.

## CI, every job step run in the sandbox

| Job (workflow) | Step / command | Exit |
|---|---|---|
| typecheck | `npm run check:rpc-typing` | 0 |
| typecheck | `npm run check:wallclock-brand` | 0 |
| typecheck (not gating in CI) | `tsc -p tsconfig.app.json` filtered to `src/modules/organiser` | 1 pre-existing error only (`edit-in-place/__tests__/TeamPicker.test.tsx:297`, untouched); the repo has many other pre-existing errors outside the module |
| architecture-guard | `bin/check-integrity.sh` | 0 |
| architecture-guard | `npm run check:legacy-tables` / `check:legacy-program-rpcs` | 0 / 0 |
| architecture-guard | `npm run lint:architecture` | 0 |
| architecture-guard | `AUDIT_STRICT=1 npm run check:images` | 0 (final tree) |
| lint chain | `npm run lint` | 0 (20/20) after `chmod +x bin/*.sh` as CI does; 1 before it (`check:integrity` exit 126 = file not executable in the sandbox checkout) |
| unit-tests | `npm run test:unit` | 1: 15 tests in 4 files fail, all sandbox-only: `eventViewCompat` / `occurrenceProgram` / `publicEventPageLineup` contract tests ("Invalid API key", live DB; CI gates them with `ci-live-db-gate.mjs`) and `integrityCouldNotRun` ("typescript resolved in the temp repo -- precondition gone"). None import the changed code. `src/modules/organiser` + `tests/regression` on the final tree: 111 files, 3191 passed, 0 failed |
| perf-budget | `npm run build` (PRODUCTION) | 0 (final tree) |
| perf-budget | `check:bundle-budget` / `check:first-load-requests` / `check:chunk-cycles` | 0 / 0 / 0 |
| e2e-smoke | `npm run test:e2e` (full list) | 1 on the first run: 157 passed, 1 failed -- `organiser-layout.spec.ts:149` (an ended event's new Ends/Prices rows rendered as `<a aria-disabled>`; the spec allows no `a[data-testid^=org-detail-]` there). FIXED (locked rows are plain `div`s now); re-run `organiser-layout` + `organiser-events`: 22 passed |


## Verified / Not verified

**Verified:** the 16 render tests (commands, payload keys, disabled reasons, tap sizes on the lifecycle card); the prod facts in Decisions 1-6 (function bodies and counts read this session); the CI table above (the e2e catch on ended events is a real bug this slice introduced and fixed before the push).

**Not verified:**
- No real phone and no browser walk at 390x844 (not run this slice); no live storage upload (the gallery upload is mocked in tests).
- Nothing sent to prod or E2E (`srrpvuxldthwumzrngla`): the commands are verified by shape against the prod validators, not by a live call.
- Where `set_recurrence` anchors the first generated date for a no-rule series (the default_start_date vs today) -- not read.
- How the public event page shows a changed `default_duration` (most series take times from programme sessions: 53/67).
- `/code-review` (owner types it) not run.

## Left (exact next steps for the continuation worker)

1. Item 9: write `src/modules/organiser/__tests__/parity-matrix.test.ts` per PARITY-GAP.md section (c): one `PARITY` table of all 66 rows (ids C01-C71 as listed there; mark C13, C19, C20, C22, C24, C26, C39, C52-C55, C59, C61 `owner: 'P-DATES'` + `it.todo`). Each built row: screen file, command kind, payload keys, reachability (`from` screen source contains the link token). Owner snapshot: kinds = upsert, add_date, remove_date, occurrence.set_time, set_lifecycle, occurrence.cancel, occurrence.set_override, skip_date, unskip_date, set_recurrence, stop_repeating, end_run; upsert keys per M21:647-651 (incl. `default_duration_minutes`, `default_gallery`, `default_video_urls`, `default_passes`, `instagram_url`). Screens are reached when `shell/OrganiserRoutes.tsx` lazy-imports them. This slice's rows after the fix: C06 MATCH (Details), C09b PARTIAL (no quantity: admin-only), C14 MATCH, C16 MATCH, C28a PARTIAL (A1), C28b PARTIAL (A1), C30b MATCH, C38 MATCH, C40 MATCH, C69 removed (no BUG). Then mutate one row, paste the red output here.
2. Browser walk at 390x844 of: a draft's One event, Details (Gallery, Videos, Ends, Prices, a team price list), Stop repeating, Make it weekly, the wizard's last step.
3. Open the PR (template "Verified on real data" block) and put the CI table in its body.

---

# Continuation (ticket `dt_144df069ea53`, brief P-SERIES-cont @987bc72)

Status: **DONE** for this slice (items 9, walk, CI). No PR opened (the brief: the integration branch collects both slices). The "Left" step 3 (open the PR) is superseded by that brief.

## Item 9: the parity matrix -- `src/modules/organiser/__tests__/parity-matrix.test.ts`

- One `PARITY` table, all 66 PARITY-GAP rows (C01-C71), verdicts after this slice: C06 MATCH, C09b PARTIAL (no quantity: admin-only), C14 MATCH, C16 MATCH, C28a PARTIAL (A1), C28b PARTIAL (A1), C30b MATCH, C38 MATCH, C40 MATCH, C69 MISSING-ADMIN-ONLY (the Home step is gone; the test fails if "Show your WhatsApp" comes back).
- Built rows (MATCH/PARTIAL): the screen is in the static import closure of a module `shell/OrganiserRoutes.tsx` lazy-imports; each write names its file (in the screen's closure, holds the builder token); the builder's output is exactly `kind` + `keys`; kind in the prod `v_owner_kinds` snapshot (12 kinds, M21:621-626) and keys in the prod key snapshot (upsert / override / cancel); a write prod refuses today needs an `a1Gate` file that reads `A1_APPLIED`; each `from` link file is reached and holds its link token.
- Snapshot vs client mirror: `OWNER_COMMAND_KINDS` minus `occurrence.move_date` (A1) = the 12; upsert/override/cancel keys equal.
- ADMIN-ONLY rows: their kind/key is in neither allowlist and no reached module file sends it. DROPPED rows: a D-number is cited in the module (R1-PLAN.md is not in this repo; C33 cites "plan 1.6" and asserts nothing calls `admin_duplicate_event_p5`).
- P-DATES rows `owner: 'P-DATES'` + `it.todo` (15): C13, C19, C20, C22, C24, C26, C39, C52-C55, C58, C59, C60, C61 (C58/C60 = its bulk/copy rows).
- Result: 164 passed, 15 todo.

**Red-first (the rule itself):** C38's `from` pointed at `shell/placeholders.tsx` (no route reaches it), then restored:
```
 FAIL  src/modules/organiser/__tests__/parity-matrix.test.ts > organiser parity matrix > 'C38' 'Open the public event page' ('MATCH') > reachable from shell/placeholders.tsx (ORG_PATHS.home)
AssertionError: shell/placeholders.tsx is in no routed module's import closure: expected false to be true // Object.is equality
 Test Files  1 failed (1)
      Tests  1 failed | 163 passed | 15 todo (179)
```
The first draft of the table also caught three real table errors (C15's create rule and C25's uncancel live on other screens; `occurrence.set_time` keys are `new_local_start/new_local_end`), fixed in the table.

## Browser walk at 390x844 -- `docs/organiser-rebuild/walk-P-SERIES/` (README there, one line per shot)

Production build (`VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build`, `node scripts/_serve-build.mjs --port 4173`), `OrganiserFake` from the phone specs, script `tests/e2e/walk-p-series.spec.ts` (NOT in the `test:e2e` gate list). 14 screens (+ `-b` scrolled shots): draft One event, Discard confirm, live See it live, Details rows, Gallery, Videos, Ends, Prices empty, a team price list read-only, Stop repeating, Make it weekly (row, step, day chosen), wizard last step. No horizontal scroll, clipping or mojibake seen.

Defects found and fixed red-first (6 tests red before, green after):
1. Wizard last step: "Save as draft" button with the reason "Choose a photo to go live." under the A1 note, and no way out but Back. Now "Choose a photo first." (`coverStepReason`) and "Save as draft and leave" shows while the button is off (`offerLeave`). e2e `organiser-events.spec.ts:66` copy updated with it.
2. Draft Go live reason named a venue/cover with no control on One event. Now "... in Details." plus an "Open Details" row under it (`org-life-details`).
3. Empty Videos sheet had no line: "No videos yet. Paste a video link below to add one."
4. See it live reason gets its full stop; Ends note says "Coming dates on the event".
Not changed: the team price list reason ends "Ask the Bachata Calendar team." (module-wide convention, tests pin it elsewhere) -- owner's call.

## CI, every job step on the final tree

| Job | Step | Exit |
|---|---|---|
| typecheck | `check:rpc-typing` / `check:wallclock-brand` | 0 / 0 |
| typecheck (not gating) | `tsc -p tsconfig.app.json` filtered to the module | 1 pre-existing (`TeamPicker.test.tsx:297`), nothing new |
| architecture-guard | `bin/check-integrity.sh` (after `chmod +x bin/*.sh`) | 0 |
| architecture-guard | `check:legacy-tables` / `check:legacy-program-rpcs` / `lint:architecture` | 0 / 0 / 0 |
| architecture-guard | `AUDIT_STRICT=1 check:images` | 0 |
| lint chain | `npm run lint` | 0 (20/20) |
| unit-tests | `env -u NODE_PATH npm run test:unit` | 1: 10 tests in 3 files, all live-DB contract (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup`: no DB key in the sandbox; CI gates them). `integrityCouldNotRun` passes with `env -u NODE_PATH`. Organiser module after the walk fixes: 101 files, 2992 passed, 15 todo |
| perf-budget | `npm run build` + `check:bundle-budget` / `check:first-load-requests` / `check:chunk-cycles` | 0 / 0 / 0 / 0 |
| e2e-smoke | `npm run test:e2e` | 1: 157 passed, 1 failed -- `dancer-home.spec.ts:188` (profile-switcher-side-dancer never appears). **Not this slice's:** it fails identically with this slice's changes stashed, and no changed file touches the profile switcher |

## Verified / Not verified

**Verified:** the matrix (and its red on a mutated row); the six walk-fix tests red before / green after; the walk screenshots on the production build at 390x844 with the fake; the CI table above.

**Not verified:** a real phone; real prod data in the walk (fake shapes only; no new prod survey this continuation -- the shapes in the survey above stand); no live command sent; `/code-review` not run (owner types it); the `dancer-home.spec.ts:188` failure's cause (base-red, outside this slice); GitHub Actions results (not read: no `gh`).

## Next

- P-DATES worker: replace the 15 `it.todo` rows with real rows (screen, sends, from) in the same table.
- Owner: the team price list "Ask the Bachata Calendar team." wording; flip `A1_APPLIED` after admin A1, then C28a/C28b become MATCH (the matrix's `a1Gate` stays as proof).
- Someone: `dancer-home.spec.ts:188` is red on this base.
