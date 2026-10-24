# ER-AUDIT rules-shell: ER-S1 rules + lookup, ER-S0 switch (card ER-C3)

Ticket dt_b080314cb5d5. Brief `docs/organiser-rebuild/briefs/ER-AUDIT.md` (sha 000dac1) on `arc/briefs-organiser-r1`.
Audited branch `claude/er-s1-rules` at `8b8c684` (ER-C3 `de7d0b4` + ER-FIX-C3). It is 17 commits behind
`origin/main` (`da22920`) and `git merge-tree` merges it with no conflict. Read-only: no source was edited.

## Verdict

| Slice | Verdict | Why |
|---|---|---|
| ER-S1 rules (`event-rules.json`, `eventRules.ts`) | **FIX** | The engine is sound. The functions are pure, the fixtures are shared data, and every mutant I planted was caught (below). What is wrong is the words and some facts. The blocker labels and the not-found sentences do not match prototype v7, which the owner approved and which wins over the rules. Main's `shared/goLiveCheck.ts` holds a second label map for the same facts, and neither map knows the five AD1 server codes. `ownerCreateFormats` still says festival is off, but AD2 supports it. A chosen ticket link with no URL counts as "how to pay". An untimed session on the first date reads as "Session times invalid", even on a live series. Each of these is a data or one-function change, so a rebuild would throw away good, tested code. |
| ER-S1 lookup (`useOrganiserSeries`) | **KEEP** | It separates loading, found, archived, no access, gone and error in the right order: home first, workspace only when home does not list the series. A series with 0 dates counts as found. It maps the real `series_not_found` P0001 reply, and it was red-first on the unfixed code. Mutants were killed. The only concerns are minor wording (see F6). |
| ER-S0 switch (`rebuildSwitch.ts`, `OrganiserRoutes.tsx`) | **FIX (minor)** | One read, default OFF, `*` = everyone, and pure tests that kill mutants. Two gaps. (1) While the home read loads, an allowlisted login sees the old screen and then the new one flashes in. (2) The allowlist works per login, so a co-organiser whose page is not on the list gets the OLD screens for the same event. Those screens carry main's owner-only organiser editing, which breaks the full-control decision for that person. Today only C8 `events/OneEvent.tsx` reads the switch. |
| Mirror check (`scripts/check-event-rules-mirror.mjs`) | **KEEP, not wired** | The script is correct and its self-test passes. It compares nothing until the admin repo has the copy (ER-C13) and an owner adds the workflow step. With no path it exits 0 with "SKIPPED ... NOTHING WAS COMPARED". So "one rule set" is not enforced anywhere yet. |

## 1. Mounted?

| Screen / piece | Route | Behind `VITE_ORGANISER_REBUILD`? |
|---|---|---|
| Add a date: Which day (`flows/add/WhichDay.tsx`), now on `useOrganiserSeries` | `/account/o/add/:seriesId` (`OrganiserRoutes.tsx:117`) | **No.** The lookup fix ships to everyone. This is fine for a bug fix, but it is not gated. |
| Add a date: Time (`flows/add/Time.tsx`) | `/account/o/add/:seriesId/:date` (`:118`) | No (same) |
| `RebuildSwitchContext` provider | wraps all organiser routes (`OrganiserRoutes.tsx` default export) | is the switch |
| `useRebuildSwitch()` consumers | none on this branch. Across all ER branches, only `claude/er-c8-eventpage` `events/OneEvent.tsx:224` | n/a |
| `eventRules.ts` consumers outside tests | C4/C7/C8/C9/C10 `sessions/sessionsModel.ts` (start/end from sessions), C8 `eventPageModel.ts:252` (`blockers`), C10 `festivalModel.ts` (default hours), C6 `publicFacts.ts` (`parsePaymentMethods`) | n/a |
| Exports that no slice reads (tests only) | `readiness`, `serverCodes`, `serverOnlyBlockers`, `ownerCanCreate`, `paymentCodes`, `cancelReasons`, `lookupMessages` (read only through `notFoundText`) | dead until a consumer lands. C7 `flows/new/model.ts:32` keeps its own format on/off list instead of `ownerCanCreate`. |

The slice has no screen of its own, so nothing is unmounted.

## 2. Plan rules owned by this family (rules 1-13 + the rule-set pieces of 14, 15, 16, 21, 26, 27, 28)

| Rule | Result | Where |
|---|---|---|
| 1 time = sessions only | PASS (functions). The ratchet lists 5 offenders that are still time inputs. | `eventRules.ts:111-120`, `__tests__/eventRules.nofield.test.ts:16-22` |
| 2 one rule set, both repos | **FAIL (not enforced)**: the admin copy does not exist yet, and there is no CI step | `scripts/check-event-rules-mirror.mjs`, F5 |
| 3 create needs (name, format, venue, first date, session, flyer, how to pay) | PASS except the ticket-link URL (F3) | `eventRules.ts:186-211` |
| 4-5, 7-9 create = publish, weekly, update live, one-date shift, cancel | NOT this slice (C7/C8/C9). The data the slice holds for them: `cancelReasons` matches the server list (PASS). | `event-rules.json` `cancelReasons` |
| 6 type derived, never asked | PASS in logic. The blocker word "Pick a type" collides with it (F10). | `event-rules.json` `blockers.format` |
| 10 publish blockers | PASS for the first date only, past date pre-live only, and next-day pairs. **FAIL** on untimed sessions (F4). | `eventRules.ts:197-205` |
| 11 optional details | PASS: description is `serverOnlyBlockers`, not a client blocker (parked; the server still requires it) | `event-rules.json` `serverOnlyBlockers` |
| 12 live events without payment stay live | PASS: payment is a blocker, never a status change | `eventRules.ts:206-209` |
| 13 enforcement in screens + server payment key | PARTIAL: codes and separator match AS BUILT. The screens' label map is split in two (F2). | `event-rules.json` `payment` |
| 14 formats (owner create) | **FAIL against AD2**: `ownerCreateFormats` = one_off and recurring only. Course has no "Not available yet" reason in the rule set (F1). | `event-rules.json:11`, `eventRules.ts:178` |
| 15 festival ticket link only | PASS | `eventRules.ts:155-158`, `paymentNotAllowed` |
| 16 switch, owner pages first | PASS with F11 | `rebuildSwitch.ts:8-13` |
| 21 start + end, end after start or next day | PASS, but the cap is 720 min where prototype v7 ends its list at start + 600 (F7) | `eventRules.ts:79-90` |
| 26 festival default 22:00-04:00 | PASS | `event-rules.json` `festival` |
| 27 six session kinds, level only on Class + Masterclass, line-up labels | PASS | `event-rules.json` `sessionKinds` |
| 28 quick lengths 45/60/90/120, default 60, lessons only | PASS | `event-rules.json` `lessonLengths` |

Prototype v7 (`organiser-prototype.html`):
- Checklist `FIX` map, line 328: `Pick a venue / Pick a date / Add a session / Add a flyer / Add how to pay`.
- Checklist labels, lines 324-327: `First date in the future`, `A session on the first date` (festival: `Party hours each night`), `How to pay` (festival: `Ticket link`, and the ticket URL must be valid).
- Not-found screen, line 569: `This event was archived` / `You can't open this event` / `We can't find this event`, each with a one-line next step.

The slice's words differ on all of these except "This event was archived" and "Ready to publish".

## 3. Server as built (ER-INTERFACE AS BUILT; AD1/AD2 handovers not readable: no access to the admin repo from this sandbox)

- How to pay: the codes `ticket_link,door,bank_transfer,cash,free`, comma separator, no repeats and no unknown codes (`formatPaymentMethods`), and festival ticket-link only all match AS BUILT.
- Go-live codes: `serverCodes` maps `no_session_first_date`, `first_date_past`, `bad_session_times`, `no_payment`, and `no_flyer` + `cover` correctly. **No screen reads `serverCodes`.** Main's `shared/goLiveCheck.ts` `GO_LIVE_LABEL` (lines 36-47) has none of the five new codes, so a server refusal shows "Something else on the event" (`UNKNOWN_ITEM_LABEL`). No ER branch adds them (checked er-wave1, er-c8-eventpage).
- `first_date_past` only pre-live: matches `preLiveStatuses`.
- Owner create formats: the AS BUILT AD1 text says one_off and recurring only, and the slice matches it. The owner's 2026-10-22 decision says AD2 now supports festival create. To switch festival on, the slice needs `ownerCreateFormats: ["one_off","recurring","festival"]` in BOTH copies of the JSON (ER-C13 carries the admin copy), plus C7 reading `ownerCanCreate` instead of its own list. Course stays off.
- `series_not_found` P0001 mapping: matches the reply the earlier reviewer read. I did not re-read the function definition (no DB access, see Not verified).

## 4. Shapes

**Survey: NOT RUN.** The Supabase connector is not authorised in this session, so no SELECT was possible. The counts below come from ER-FIX-C3's own survey (2026-10-21) and were not re-checked:
- live 67 (recurring 44, course 6, one_off 10, festival 7); ended 21; paused 2; draft 2; archived 653.
- 662 programme items: 223 untimed, 78 next-day, 7 over 720 min (live festivals).

How each shape reads in code:

| Shape | Handled? |
|---|---|
| live with a past first date (43/44 recurring) | yes: no `dateInPast` after go-live |
| live festival session over 12 h (7) | yes: the cap applies pre-live only |
| **first date holding an untimed programme item (223 untimed items in prod)** | **no**: `validSessionPair(null, null)` is invalid, so `sessionTimes` "Session times invalid". This also applies on live series, because only `dateInPast` and the cap are gated by status. |
| `passes` stored, no payment code (3 live) | reads "How to pay needed". Documented, owner to pick. |
| ticket_link chosen, no ticket URL | **reads ready** (prototype says not) |
| draft with 0 dates | lookup `found`; readiness `date` |
| series home does not list (co-organiser, other page) | workspace fallback: no-access / gone / archived |
| two-organiser events (6), no-organiser events (571) | the lookup does not look at organisers. Not checked against prod. |
| course 15, festival 12 | readiness only (create is C7) |
| more than 100 rows | the lookup reads RPC jsonb (`organiser_home_v1`, `admin_event_workspace_p5`), so the PostgREST row cap does not apply. Not checked on prod. |

## 5. Tests

Run on `8b8c684`, worktree, sandbox:
- `npx vitest run` on the 7 slice files: **127 passed / 0 failed**.
- Whole `src/modules/organiser`: **3469 passed, 2 skipped, 0 failed (123 files)**.

Mutation check (one mutant at a time over `shared/__tests__` + switch + notFound tests; each was reverted afterwards):

| Mutant | Killed by |
|---|---|
| `dateInPast` ignores status | 5 failures |
| rollover ignores the evening rule | 2 |
| session cap always 720 (not pre-live only) | 1 |
| festival-day check removed | 1 |
| empty switch env = ON | 3 |
| `series_not_found` no longer maps to gone | 3 |

Vacuous or weak:
- `editorGuards.test.ts` "untouched save sends nothing" compares `formToDraft(basicsFormFromSeries(s))` with itself. A `hasBasicsChanges` that always returns false still passes. Only the `basicsPayload` keys assertion has teeth.
- The ratchet regex (`type="time"`, `<TimeField`, `<TimePicker`) misses a `<select>` of times or a time list picker. It is a floor, not proof that rule 1 holds.
- There is no test that the blocker words equal the prototype or `GO_LIVE_LABEL`, so F2 passes CI.

Other checks:
- `node scripts/check-event-rules-mirror.mjs --self-test`: exit 0. The run without a path: exit 0 with "SKIPPED ... NOTHING WAS COMPARED".
- eslint on the 7 changed source and script files: 0 problems.
- `tsc -p tsconfig.app.json`: no errors in the touched files.
- `check-script-conventions.mjs`: passed.

## 6. Design

The slice adds no UI. WhichDay and Time reuse the existing `Refusal` with "Back to Home". ER-FIX-C3 reports a 44px button and no sideways scroll at 390x844. I did not see any screenshot or run a browser, so contrast, clipping and seams are not verified by me. The JSON strings use ASCII `'` ("don't"), which is safe against the mojibake rule. The prototype uses `&rsquo;`.

## 7. Dead code and duplication

- **Two label maps for one fact**: `event-rules.json` `blockers` ("Flyer needed") and main `shared/goLiveCheck.ts` `GO_LIVE_LABEL` ("Upload a flyer"). Prototype v7 has a third set ("Add a flyer").
- C7 `flows/new/model.ts:32` holds its own format on/off list with `'Not available yet'`, beside `ownerCreateFormats`.
- `findSeries` / `allSeries` are now ONE copy (`useOrganiserSeries.ts:33-37`), re-exported from addModel and changeModel. Good. Callers still on the synchronous form are listed in ER-C3 handover for ER-S4.
- No `sections/` files are touched.

## Findings

| id | sev | file:line | what | failing scenario | fix in words |
|---|---|---|---|---|---|
| F1 | major | `shared/event-rules.json:11`, `eventRules.ts:178` | `ownerCreateFormats` lacks festival (AD2 supports it). There is no rule-set reason for an off format. | Owner switches festival on; C7 still greys it out (and C7 has its own list anyway) | Add `festival` to `ownerCreateFormats` once AD2 is applied to prod. Add `formatOff: { "course": "Not available yet" }` to the JSON. C7 reads both. Copy byte-for-byte to admin (ER-C13). |
| F2 | major | `event-rules.json` `blockers`, `seriesLookup`; main `shared/goLiveCheck.ts:36-47` | Blocker words are not the prototype's actions. A second map exists in goLiveCheck, and none of the five AD1 codes has a label. | Draft without flyer: the checklist reads "Flyer needed", the go-live card reads "Upload a flyer", the prototype says "Add a flyer". The server's `no_payment` reads "Something else on the event". | ONE map. Prototype action words go in `event-rules.json` (`Pick a venue`, `Pick a date`, `Add a session`, `Add a flyer`, `Add how to pay`, festival `Party hours each night` / `Ticket link`). `GO_LIVE_LABEL` derives the server codes from `serverCodes`. Add a test that every server code has a label. |
| F3 | major | `eventRules.ts:206-209`, `RuleSeries` | `ticket_link` counts as payment without a ticket URL | Draft with Ticket link ticked and the URL empty reads "Ready to publish"; the prototype (`okTicket`) blocks it | Add `ticketUrl` to `RuleSeries`. Block `payment` when `ticket_link` is the only code and the URL is not a valid http(s) URL. Add a fixture row. |
| F4 | major | `eventRules.ts:201-202` | An untimed session counts as an invalid pair | Live weekly whose first date carries an untimed item (223 such items in prod) shows "Session times invalid" | Ignore sessions with both times null for `sessionTimes`. Count only timed sessions for `session`, to match server `no_session_first_date` (AS BUILT: "timed session"). Confirm against AD1's function body. Add fixtures. |
| F5 | major | `scripts/check-event-rules-mirror.mjs` | The mirror compares nothing: no admin copy and no workflow step | Admin changes a rule; the Website never learns | Needs owner: workflow step (admin checkout + `--admin` + `EVENT_RULES_ADMIN_REQUIRED=1`). ER-C13 lands the admin copy. |
| F6 | minor | `event-rules.json` `seriesLookup` | Not-found sentences differ from prototype v7 and have no next-step line | No-access reads "You don't have access to this event" with no hint | Use the v7 title + line pairs (archived / can't open / can't find). |
| F7 | minor | `eventRules.ts:76,79-90` | Cap 720 min vs prototype end list start + 600 | A 10 h 15 end is valid in rules but not offered in the v7 picker | Owner pick: one number in the JSON that both the picker and the rule read. |
| F8 | minor | `eventRules.ts` exports | `readiness`, `serverCodes`, `ownerCanCreate`, `paymentCodes`, `cancelReasons` are not read by any slice | A slice re-implements them (C7 format list) | Wire the consumers (C7, C8 checklist, C9 cancel sheet) or drop the exports |
| F9 | minor | `event-rules.json:2` `$comment` | Says an end "at or before" its start is the next day; the code says equal is invalid | Admin reads the comment and builds the wrong rule | Fix the comment: "before". |
| F10 | minor | `event-rules.json` `blockers.format` | "Pick a type" collides with rule 6 (type is derived) | Organiser looks for a type picker that does not exist | "Pick how often", or drop it (create always sets the format) |
| F11 | minor | `OrganiserRoutes.tsx` (switch read), `rebuildSwitch.ts:8` | The switch is false until home loads; it is per login | An allowlisted login sees the old screen flash. A co-organiser not on the list sees main's owner-only organiser editing on a shared event. | While the env is a non-empty list that is not `*` and home is loading, render the skeleton. Allowlist every page on the owner's events, or go to `*` before co-organising is used. |
| F12 | minor | `shared/__tests__/editorGuards.test.ts` (ER-S1 block) | The untouched-save test compares a value with itself | An always-false `hasBasicsChanges` passes | Assert against a stored payload or a send spy |
| F13 | minor | `shared/selfServeErrors.ts` | No shared classifier for retry-as-success (`already invited`, `invalid_payload: this invite is no longer open`) | C11 and C9 each invent one, or show an error | Add `isRetrySuccess(error)` beside `isSeriesNotFound` and let C11/C9 use it |
| F14 | minor | branch | 17 commits behind main (merges clean) | CI on the merged tree not run | Merge main into the branch before any PR re-run |

## Full control (owner-only anywhere?)

- **This slice enforces no owner-only rule.** It has no cancel, stop-repeating or organiser-list control, and no "owner only" copy, disabled state or hidden control (grep over the diff).
- `ownerCanCreate` / `ownerCreateFormats` use "owner" to mean the organiser self-serve path, not the owner team. They are not a permission, but rename them `organiserCanCreate` / `organiserCreateFormats` so owner-only sweeps stop flagging them.
- Indirect: F11. While the switch is a per-login allowlist, a co-organiser outside it is served the OLD screens, which still carry main's owner-only organiser edits.
- Retries-as-success: nothing in this slice sends an invite or a cancel. The shared error module has no classifier for these replies (F13).

## Verified

- I read the brief, ER-C3, ER-COMMON, ER-INTERFACE (AS BUILT), PLAN rules 1-29, prototype v7 checklist and not-found screen, the slice handovers and parked questions, and the full slice diff.
- The 7 slice test files: 127/127 pass.
- Organiser suite: 3469 passed, 2 skipped.
- 6 of 6 planted mutants were killed.
- Mirror self-test: exit 0. eslint on the changed files: clean. tsc: clean on the touched files. Script conventions: pass.
- `git merge-tree` origin/main + slice: no conflict.
- Consumers of the switch and of the rules exports, traced across all ER branches by `git grep`.

## Not verified

- Prod shape survey: the Supabase connector is not authorised here, so the counts above are ER-FIX-C3's, not mine.
- The admin repo, the AD1/AD2 handovers and the `series_not_found` / `bad_session_times` / `no_session_first_date` function bodies: no access to `bachata-admin-11april`. F4 rests on ER-INTERFACE AS BUILT wording.
- AD2 festival create: taken from the audit brief's owner decision only.
- Full `npm run lint`, `npm run build`, e2e, phone-qa: not re-run (read-only audit; ER-FIX-C3 reports them).
- Any browser or phone walk, screenshots, contrast.
- Vercel: not touched.
