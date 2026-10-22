# ER-AUDIT: new-event family (ER-C7 New event)

Ticket `dt_e4a63eefa188`. Read-only audit per brief `ER-AUDIT.md` (blob `000dac1`). No source edited.

| Slice | Branch | Head audited | Base |
|---|---|---|---|
| ER-C7 New event | `claude/er-c7-new` | `3202aaf` (on wave 1: S1 `de7d0b4`, UI `f223403`, C4 `2d08170`, C5 `fa85509`) | `b098334`, **18 commits behind** `origin/main` `3a21361` |

Judged against prototype v7 and PLAN rules 1-29 (on `claude/er-c1-docs`), ER-INTERFACE AS BUILT, the owner decisions in the dispatch (festival create ON, course OFF, untimed sessions valid, the rebuild switch is per event), and the editor-cards audit (`claude/audit-er-editor-cards`).

## Verdict

**ER-C7 New event: REBUILD.** The pure helpers are fine and worth keeping (`dateCommands`, `venueCommands`, `togglePayment`, `ticketLinkProblem`, the "untouched sends nothing" idea). The slice as a whole cannot be fixed in place, for five structural reasons:

1. **It is not behind the rebuild switch.** It rewrote `flows/new/**` in place. `OrganiserRoutes.tsx:124-129` mounts it for everyone, and nothing in `flows/new` reads `useRebuildSwitch`. Merging it replaces New event for every organiser on day one.
2. **It is built on a stale base.** Since `b098334`, main's `flows/new` gained the which-page step (Arc 1 flow 7b, `WhichPage.tsx` and `whichPageModel.ts`), the "Almost live" profile bridge (`profileQuestionsLeft` -> `goLivePath`), the shared session rule (#885), and the F1 fix in `useNewSend`: the server's upsert handler requires `name` on every call (`withSeriesName`). C7 has none of these. Every venue, date, flyer and payment upsert it sends would be refused by the live server, and merging it would drop the main features.
3. **It reads the go-live check with an invented shape.** The real shape is `{ready, event_missing:[{code,section}], recommended, profile_rule_applies, profile_missing}`; main already parses it in `shared/goLiveCheck.ts`. C7 reads `blockers` or `missing`, so every real server blocker collapses to one "Not ready" with no way to fix it (proved by a probe, below). All of its tests fake the invented shape, so they cannot catch this.
4. **Its formats are its own list, not the shared rule.** Festival is absent, although the owner has switched festival create ON. There is no festival path at all: no days, no nights step, no "Where do people buy tickets?".
5. **Its step structure differs from prototype v7.** The prototype has nine steps, one question each: name, format, venue, date (+ days/weeks), session or nights, flyer, pay, an optional "Anything else?", then "Ready to publish" with Publish and a quiet Save as draft. C7 has six legacy routes, and its last screen puts flyer, how to pay, description, preview and Publish together. There is no review step, no optional-details step (rule 11: styles, gallery, video), and the live preview appears on the last step only (rule 17).

Fixing items 1, 2 and 5 means a new directory, a new route split and a new step list. That is a rewrite of every component in `NewFlow.tsx`, so it is a REBUILD, not a FIX.

## 1. Mounted?

| Screen | Route (C7 branch) | Behind `VITE_ORGANISER_REBUILD`? |
|---|---|---|
| What (format) | `new/what` -> `NewFlow` `WhatStep` (`OrganiserRoutes.tsx:124`, `NewFlow.tsx:94`) | **NO** (unconditional) |
| Name (creates the draft) | `new/name?format=` (`:125`, `NewFlow.tsx:125`) | NO |
| Venue (C5 picker) | `new/:id/venue` (`:126`, `NewFlow.tsx:177`) | NO |
| First date | `new/:id/date` (`:127`, `NewFlow.tsx:207`) | NO |
| First session(s) (C4 sheet) | `new/:id/time` (`:128`, `NewFlow.tsx:241`); the URL name is legacy | NO |
| Flyer + pay + details + preview + Publish | `new/:id/cover` (`:129`, `NewFlow.tsx:327`) | NO |
| Festival entry | none (the C7 header says ER-C10 owns it; C10 has no New event entry either) | NOT BUILT |

The switch context is provided (`OrganiserRoutes.tsx:95`) but not read anywhere in `src/modules/organiser` outside `rebuildSwitch.ts`. Owner decision: the switch is **per event**. New event has no event yet, so the rebuild needs a rule for which key decides it. The sensible default: the selected organiser page is in the list, or the list is `*`; the created series then counts as a rebuild event. This needs the orchestrator's click.

## 2. Plan rules owned (prototype v7 + PLAN rule sheet)

| Rule | Verdict | Where (C7 branch) |
|---|---|---|
| 1 time = sessions only, no start-time field | PASS | no time input (`NewFlow.test.tsx:367`); start comes from the session step |
| 3 create needs name, format, venue, first date, session(s), flyer, how to pay (5 codes, bank = "message the organiser") | PARTIAL: all collected, but the bank hint "Dancers message you for details" (prototype l.441) is missing; Course has no weeks | `NewFlow.tsx:422-432` |
| 4 create = Publish (live at once), quieter Save as draft | PASS on behaviour (`NewFlow.tsx:389-410`); FAIL on placement: the prototype puts both on a separate "Ready to publish" review step | |
| 5 weekly: first date sets the weekday | PASS (`model.ts:52-55`); the "Then every Friday" hint under each date (prototype l.434) is missing | |
| 6 type from the sessions, never asked | PASS: no category (`upsertCommand` strips it; source test `NewFlow.test.tsx:367`) | |
| 10 Publish blockers disabled with a reason | PARTIAL: local rules plus the server check (`model.ts:178-189`), but the server half reads the wrong shape (F-C7-3), and untimed sessions block, against the owner decision (F-C7-9) | |
| 11 optional details: description + music styles, gallery + video | FAIL: description only (`NewFlow.tsx:440-442`); no "Anything else?" step with Skip | |
| 12 live events without payment | N/A for create | |
| 14 formats Weekly, One-off, Course, Festival | FAIL vs the owner decision: own list `model.ts:29-33` (festival absent); Course OFF "Not available yet" PASS | |
| 17 desktop two panes with a live "How dancers will see it" | PARTIAL: two panes only on the last step (`NewFlow.tsx:414`, `lg:grid-cols-2`); the prototype shows the preview beside every step, with placeholders ("Event name", "Date", "From the sessions", "Venue", "How to pay", prototype l.461-467) | |
| 22 one or more sessions, Add another, time order | PARTIAL: through the C4 sheet (`SessionSheet.tsx:95`, pre-fix copy). The step shows summary rows and one "Edit sessions" button instead of the cards inline; there is no "The night runs 20:00 - 02:00" line (prototype l.437) | `NewFlow.tsx:283-300` |
| 26 festival nights each with own hours, default 22:00-04:00 | NOT BUILT | |
| 29 new venue | Inherited from C5 (pre-fix copy; editor-cards F-C5-1: four steps vs the prototype's one sheet) | `NewFlow.tsx:198` |
| Prototype: name at least 3 letters, "Type a name" | FAIL: any non-blank name; copy "Type a name to go on." (`model.ts:195`) | |
| Prototype: 7 dates from tomorrow, pick then Next | DIFFERENT: 30 rows from today, and a tap saves at once (`model.ts:61`, `NewFlow.tsx:225`) | |

## 3. Server as built

| Item | Verdict |
|---|---|
| Owner create `one_off`/`recurring` (AD1) | PASS (`draftCommand`, `model.ts:43`) |
| Festival create (AD2, owner: ON) | NOT BUILT. The payload for days and nights is in the AD2 handover (admin branch `claude/er-ad2-admin`), which **this sandbox cannot read**. |
| `series.upsert` needs `name` on every call (F1, main #880) | **FAIL**: `useNewSend.ts:29-38` has no `withSeriesName`; main's copy does |
| `payment_methods` comma list, blank clears | PARTIAL: sent (`model.ts:138`) but never cleared. Unticking everything, or blanking the description or ticket link, sends nothing (`model.ts:135-142`; probe: touched + empty -> `[]`). Not in the client mirror `OWNER_UPSERT_KEYS` (`seriesCommands.ts:31`). Not read back, so a returning draft shows nothing ticked (`NewFlow.tsx:355`; the worker parked this) |
| `series_go_live_check_v1` result | **FAIL**: parsed as `{ready, blockers|missing}` (`goLiveCheck.ts:15-27`). The real result is `event_missing[{code,section}]` + `profile_missing` (main `shared/goLiveCheck.ts`) |
| Go-live codes `no_session_first_date, first_date_past, bad_session_times, no_payment, no_flyer, cover` | Mapped (`model.ts:152-159`), but never reached (above). This is a second code -> words map beside main's `GO_LIVE_LABEL`; existing codes (`description`, `city`, `upcoming_date`, `organiser`, ...) fall to the generic words |
| Description still required to go live (AD1) | Screen says "Description (optional)" (`NewFlow.tsx:440`), and the server block then shows as "Not ready" with no fix. The interface says: do not offer what the server refuses |
| Lifecycle `live` refusal "needs a ready series: {json}" | Shown as a generic error (`NewFlow.tsx:401`, `useNewSend` -> `commandErrorMessage`); main has `goLiveRefusal` |
| `organiser_set_occurrence_programme_v1` | Own third wire mapping `sessionsWire` (`model.ts:78-93`) beside `programmeModel.buildPayload` and C4's `toStored`. **Drops `room`**; sends `start_time: ''` and `ends_next_day: true` for an untimed session (probe) |
| Retries | Name: one key per name+format (`NewFlow.tsx:134-144`), so a retry replays. Steps: one key per command signature (`useNewSend.ts:31-36`). PASS |

## 4. Shapes

The Supabase connector needs owner authorisation in this session, so **no fresh survey was run**. The counts below are from the C7 handover's survey (2026-10-21) and the brief.

| Shape | C7 handles? |
|---|---|
| Organiser with 1 page / 2+ pages | 1: PASS. **2+: FAIL**, because main's "Which page is this for?" is gone and the default page is used silently |
| Organiser blocked from creating (`createBlock`) | PASS (empty state with Back to Home, `NewFlow.tsx:157`) |
| Draft whose first date has NO occurrence row | **Dead end**: Next is off with "Pick the date first" though the date was picked (`NewFlow.tsx:262`). Untested against prod; the worker parked it as "large" |
| Draft with an occurrence row, step revisited | **Data loss**: the step starts from the default "Party 21:00" (`:247`), not the stored sessions, and Next marks the stored ones removed (`:270`) |
| Weekly draft whose date was changed | Falls back to `dates[0]` (`:246`, `:342`), which can be an older date |
| Returning draft with stored `payment_methods` | Shows none ticked; Publish says "How to pay needed" |
| Draft with stored description, untouched | Pre-filled, and "untouched sends nothing" holds only because `touched` is false (mutation M4: no test covers this shape) |
| Untimed session (223 on prod) | Blocks Publish "Session times invalid" (shared `eventRules.ts:162`) against the owner decision; wire sends `''` |
| Festival draft (12) / course (15) | Course: OFF row, PASS. Festival: if a festival draft reaches the date step it is treated as weekly and sent `set_recurrence` (`NewFlow.tsx:216`) |
| Two-organiser (6) / no-organiser (571) events | N/A for create. The create carries the selected page; there is no owner-only copy (section 6) |
| >100 rows | Venues 66 (one list), people search is capped by `PEOPLE_SEARCH_LIMIT` 20: fine |

## 5. Tests

| Run (sandbox, `TZ=Europe/London`, worktree of `3202aaf`) | Result |
|---|---|
| `npx vitest run src/modules/organiser/flows/new` | 2 files, 62 passed |
| flows/new + parity-matrix + consistency.render.matrix + shell + eventRules.nofield | 12 files, 510 passed, 2 skipped |
| `npx eslint src/modules/organiser/flows/new` | 0 |
| `tsc -p tsconfig.app.json` errors in `flows/new/` | 0 (one pre-existing error in `flows/newpage`) |
| Unicode punctuation in `flows/new` | none |

Mutations (each reverted):

| Mutant | Result | Meaning |
|---|---|---|
| M1 drop `people_add` from `sessionsWire` | 62 pass | the line-up chosen in create is never checked |
| M2 drop the local rules from `publishReasons` | 16 fail | good |
| M3 `ends_next_day: false` | 1 fail | good |
| M4 ignore `touched` in `finishCommands` | 62 pass | "untouched sends nothing" is pinned only by an empty fixture; vacuous for a stored description |
| M5 also read `event_missing` | 62 pass | tests never feed the real server shape |

Probe (real shape `{ready:false, event_missing:[{code:'description'},{code:'no_payment'}], ...}`): `parseGoLiveCheck` -> `{ready:false, blockers:[{code:'not_ready'}]}`; `publishReasons` -> `["Not ready"]`.

The formats x blockers table (`NewFlow.test.tsx:105-126`) is table-driven but runs over the 2 formats only, not the shapes in section 4. No test covers a revisited session step, 2+ pages, a festival, or a missing occurrence.

## 6. Full control (owner decision 2026-10-22)

New event has no cancel, stop-repeating or organiser-list control, and `flows/new` contains no "owner only" copy or disabled state (the only `owner` hits are the `OwnerCommand` type). **Nothing to flag in this slice.** A rebuilt New event must not add an owner-only gate when it adds co-organisers.

## 7. Design, contrast, tap targets

- Tap targets: explicit px everywhere (rows 56px `NewFlow.tsx:40`, quiet links 44px `:42`, ticket input 48px `:436`); the source test checks `min-h`. PASS.
- Density: create steps are "roomy Monzo cards" by rule 23, so full-width rows are right. The 30-row date list (`:225`) is long on 390x844, where the prototype has 7.
- Entities: no raw Unicode; separators are ASCII " - " (`model.ts:198`, `NewFlow.tsx:318,453`). Prototype wording uses "Live" plus a toast. Minor.
- `docs/design/` has no record for New event (none on main or the branch).
- Not seen: no screenshots exist (the worker had no signed-in session, and neither does this sandbox). Contrast, clipping and sideways scroll were judged from code only: `ROW_OFF` is `opacity-60` text on `--card2` (could fall under 4.5:1, unmeasured), and the Publish reasons are joined into one `text-[13px]` line (`:453`).

## 8. Dead code and duplication

- `flows/new/goLiveCheck.ts` duplicates main's `shared/goLiveCheck.ts`, with a different and wrong shape. `SERVER_REASON` (`model.ts:152`) duplicates `GO_LIVE_LABEL`.
- `sessionsWire`/`replaceProgramme`/`ruleSessionsOf` (`model.ts:78-106`) are a third copy of the programme wire mapping (`shared/programmeModel.ts` `buildPayload`, C4 `toStored`).
- `FORMAT_WORDS` (`model.ts:40`) is a format -> words map; check whether the shell already has one before keeping it.
- `liveCommands(a1)` keeps the A1 gate only for the parity matrix (`model.ts:145`).
- Pre-fix copies of `sessions/**` and `venue/**` (editor-cards audit, family-wide): whichever merges last wins.

## Findings

| id | sev | file:line (C7 branch) | what | failing scenario | fix in words |
|---|---|---|---|---|---|
| F-C7-1 | blocker | `shell/OrganiserRoutes.tsx:124-129`, `flows/new/**` | rebuilt in place, not behind the switch | merge = every organiser gets the rebuilt flow, with the server not landed | build in a new dir; route picks old/new by the switch |
| F-C7-2 | blocker | `flows/new/useNewSend.ts:29-38` | no `withSeriesName` (F1) | live server refuses every venue/date/flyer/pay upsert | rebase on main; take main's `useNewSend` |
| F-C7-3 | blocker | `flows/new/goLiveCheck.ts:15-27`, `model.ts:152-189` | wrong result shape | any server blocker shows only "Not ready", with no fix path | use `shared/goLiveCheck.ts` and `goLiveLabel`; delete the local copy |
| F-C7-4 | blocker | `flows/new/model.ts:29-37` | own format list, festival absent | owner switched festival ON; New event cannot create one | add `ownerCreateFormats` + `ownerCanCreate` to both copies of `event-rules.json`; read it |
| F-C7-5 | major | `flows/new/NewFlow.tsx:94-121, 389-403` (vs main) | which-page step and "Almost live" bridge lost | 2+ pages: wrong page silently; profile not done: "Not ready" dead end | carry main's `WhichPageStep` and `profileQuestionsLeft` |
| F-C7-6 | major | `NewFlow.tsx:247,270` | session step ignores stored sessions | revisit the step, tap Next: stored sessions removed, default party saved | load the stored programme into the sheet; send through `buildPayload` |
| F-C7-7 | major | `NewFlow.tsx:246,262` | needs an occurrence row; `dates[0]` fallback | draft without an occurrence: Next off with false copy; weekly date changed: sessions on an old date | match by date only; when none, ask the server to materialise (or save to the series programme) |
| F-C7-8 | major | `model.ts:78-93` | own wire mapping drops `room`, sends `''` times | a typed room is lost; an untimed session may be refused | one mapping (`buildPayload`/`toStored`) |
| F-C7-9 | major | `shared/eventRules.ts:162` (used by `model.ts:179`) | untimed session = "Session times invalid" | owner: untimed is valid; only a half-filled time or a bad pair blocks | fix in the shared rule (rules-shell); align with the C4 FIX |
| F-C7-10 | major | `NewFlow.tsx:413-456`, `model.ts:202-209` | steps differ from prototype v7 | no review step, no "Anything else?" step, preview on the last step only | build to the prototype's 9 steps |
| F-C7-11 | major | `NewFlow.tsx:440` | description "optional" but the server requires it (AD1) | Publish refused with no named reason | either require it on screen until AD changes, or get the server changed; say which |
| F-C7-12 | major | `NewFlow.tsx:355`, `model.ts:135-142` | payment not read back; clearing sends nothing | returning draft: "How to pay needed"; blanking a link or description keeps the old one | read `payment_methods`; send blank or null for cleared fields when touched |
| F-C7-13 | minor | `NewFlow.tsx:401` | go-live refusal shown generic | server refuses at the lifecycle step | `goLiveRefusal` + labels |
| F-C7-14 | minor | `NewFlow.tsx:216` | non-one-off = weekly | festival draft gets `set_recurrence` | branch on all four formats |
| F-C7-15 | minor | `model.ts:195`, `:61` | name min 0 vs 3; 30 dates vs 7 + "Then every ..." | wording and length differ from the prototype | follow the prototype |
| F-C7-16 | minor | `NewFlow.tsx:337,373-386` | `blockedBy` not cleared on flyer upload | after a server block, a new flyer leaves Publish off until a field changes | clear it on upload |
| F-C7-17 | minor | `__tests__/NewFlow.test.tsx:39,118-143` | tests fake an invented server shape; M1/M4 survive | wrong builds pass | fake the real shape; add revisit, 2+ pages, festival, no-occurrence and stored-description rows |

## Festival: what switching it on takes

1. `event-rules.json` (both copies, admin mirror check) gains `ownerCreateFormats: ["one_off","recurring","festival"]`; `eventRules.ts` exports `ownerCanCreate(format)`; course reads OFF from the same rule with "Not available yet".
2. New event's format step lists `rules.formats` and asks `ownerCanCreate`; `NewEventFormat`/`parseFormat` (`shell/paths.ts`) and `OwnerFormat` accept `festival`.
3. Date step: "How many days?" (2-5). Then the "Party hours each night" step reuses C10's `FestivalNights` (rule 26, default 22:00-04:00, no "same every night" switch). Each day needs a TIMED party: AS BUILT, `no_session_first_date` fires when any day has none. The pay step becomes "Where do people buy tickets?" (ticket link only; `paymentCodes('festival')` already does this). Review: "N days from ...", "Parties from 22:00".
4. The create and days payload follows the AD2 handover (not readable here: **needs the orchestrator to pin it in ER-INTERFACE**).

## REBUILD would need (tell the fresh worker)

- Branch from **current `origin/main`**, not wave 1. Take main's `flows/new` behaviour as the floor: which-page step, the `withSeriesName` F1 fix, the "Almost live" bridge, and `shared/goLiveCheck.ts` with `GO_LIVE_LABEL`.
- Build in a NEW directory (e.g. `flows/new-er/`). `OrganiserRoutes` picks old or new by the rebuild switch; the old flow stays until the switch is `*`. Get the orchestrator's answer on the per-event key for create first (default: the selected page).
- Steps = prototype v7: name (3+ letters), format (from `ownerCanCreate`; course OFF "Not available yet"), venue (C5 after its FIX), date (+ days for festival), sessions (C4 cards inline after its FIX, "The night runs ...") or festival nights (C10), flyer, pay (festival: ticket link only), "Anything else?" (description, music styles, gallery, video, with Skip), review "Ready to publish" with Publish + quiet Save as draft. Preview pane beside every step on desktop.
- One programme writer (`buildPayload`/`toStored`); load stored sessions on revisit; match the occurrence by date; untimed valid.
- Read `payment_methods` back; clearing sends blank.
- Description: the server still requires it, so either require it on screen or wait for an AD change. The interface says do not offer what the server refuses.
- Tests: fake the REAL go-live shape; table over formats (incl. festival) x the section 4 shapes; mutation-check line-up and "untouched sends nothing".

## Verified

- Brief blob sha `000dac13733131f9d63f97056c11b88e961f4308` read.
- C7 source, handover, parked file and prototype v7 read; PLAN rules 1-29 and D1 read; ER-INTERFACE AS BUILT read; editor-cards audit read.
- Tests, eslint, tsc and the unicode check above, run in a worktree of `3202aaf`. Five mutations and one probe were run, then reverted.
- Route trace showing the switch is unread; diff of main's `flows/new` since the base.

## Not verified

- **No prod shape survey**: the Supabase connector needs owner authorisation in this session. Not checked: whether drafts get an occurrence row, and live go-live results.
- The AD1/AD2 admin handovers (no admin repo access): festival create payload unknown.
- No browser walk or screenshots at 390x844 (no signed-in session); contrast was not measured.
- Whether AD1 is applied on prod now.
