# ER-AUDIT: event-page family (ER-C8)

Audited branch `claude/er-c8-eventpage` at `ec4dfc1` (one commit on `claude/er-wave1` `4c6d1f5`). Card ER-C8, ER-COMMON, ER-INTERFACE (AS BUILT), PLAN.md rules 1-29 / D1 gaps / CO-ORGANISING, prototype v7 (`organiser-prototype.html` on `arc/briefs-organiser-r1`). Ticket `dt_5823fcc8464f`. Read-only: no source edited.

## Verdict

| Slice | Verdict |
|---|---|
| ER-C8 event page (`events/EventPage.tsx`, `events/eventPageModel.ts`, `RebuiltEvent` in `events/OneEvent.tsx`) | **FIX** |

**Why FIX, not REBUILD.** The structure is right and worth keeping: one pure model (`eventPageModel.ts`) holds every fact the page shows twice, the save sends only what changed (an untouched page sends `[]`), sessions reuse the C4 `SessionSheet` and the venue reuses the C5 `VenuePicker`, the time row and time inputs are gone, the price list and Instagram editors are gone, the scope line matches rule 7 word for word, and the tests are live (mutating the scope count or the owner gate turns them red). What is wrong is a bounded list: the 2026-10-22 "everyone has full control" decision is broken in the model and pinned by two tests; a remount key throws away the person's pending changes after a partly-failed update (the exact case the "Your changes are still here" copy promises); "Ticket link" can be picked as the way to pay with nowhere to type the link; the organiser list and "Leave this event" are unreachable from the rebuilt page; leaving through any link other than the page's own Back loses edits silently; and `payment_methods` is not in `OWNER_UPSERT_KEYS`. Each is a local change inside the files the card already owns. None needs a different design.

## Findings

| id | sev | file:line (on `ec4dfc1`) | what | failing scenario | fix in words |
|---|---|---|---|---|---|
| EP-1 | blocker | `events/eventPageModel.ts:279-287`, `events/EventPage.tsx:95,120,357` | Actions gated on `owner`: a non-owner gets Pause only on live, NOTHING on paused (no Resume, no End) and nothing on a draft (no Delete). | Owner decision 2026-10-22: every organiser sees cancel, stop repeating and the organiser list. A co-organiser on a paused event cannot resume it. | Drop the `owner` argument from `pageActions` and the `owner &&` on Resume; delete the `owner` const. Flip `er-c8.model.test.ts` "a co-organiser never gets End..." and `er-c8.page.test.tsx:230` to assert the SAME actions for owner and co-organiser. Server: AD1 as built still refuses these for a co seat (`permission_denied: <kind> is for the owner organiser's team only`) -- the screen must not show a control the server refuses, so this needs AD2 (or a follow-up admin migration) to lift the owner-only check; record that dependency. |
| EP-2 | blocker | `events/OneEvent.tsx` `RebuiltEvent` (`<EventPage key={ws.data.series.version} ...>`) + `EventPage.tsx:143-146` | The page is keyed on `series.version`. `saveAll` sends commands one by one; if command 1 succeeds and command 2 fails, `refresh()` refetches, the version has moved, React remounts `EventPage`, and the draft, the error and Try again are all gone. A background refetch after another organiser saves does the same mid-edit. | Rename + change sessions on a live event, the programme save fails (offline): the name is saved, the session edits vanish, no error shows. Copy said "Your changes are still here." | Key on `series.id` only. Rebase the draft explicitly: when `ws` changes, keep the person's draft and recompute `pending` against the new base (fields already equal drop out by themselves). Test: two commands, second returns null, assert the session edit and `org-update-failed` are still on screen. |
| EP-3 | major | `EventPage.tsx:399-407`, `EditorSheet.tsx:291` | "Ticket link" is a way-to-pay chip, but the page never opens the `ticket` sheet; there is no field for the URL. `paymentOf` also counts a stored URL as `ticket_link`, so clearing the chip leaves the URL stored. | Draft with no ticket URL: pick Ticket link, publish. Public page says pay by ticket link; there is no link. | When `ticket_link` is selected show a "Ticket link" row that opens `EditorSheet` `ticket`; publish/Update off ("Add the ticket link") while the chip is on and the URL is empty. |
| EP-4 | major | `EventPage.tsx` (no organisers section) | The organiser list (rule CO-ORGANISING, D1 gap "Event: co-organisers") is not on the rebuilt page and nothing links to the old Details screen, so with the switch ON nobody can see or change organisers or Leave. | Switch ON, any event: no "Organisers" block. | Mount `SeriesOrganisers` (C11 owns its inside) under Details, visible to every organiser. Coordinate with the co-organisers audit. |
| EP-5 | major | `EventPage.tsx:125-130,160,272,285,296` | The leave prompt only covers the in-page Back button and tab close. The date rows, "+ Add a date", the flyer row, the event list on desktop, Pause/End links and the shell nav all navigate away with no prompt and lose the pending changes. | Live event, change the name, tap a coming date: the rename is gone, no prompt. | Use a router blocker (`useBlocker`) driven by `shouldPromptLeave`, so every navigation gets "Update before you leave?". |
| EP-6 | major | `shared/seriesCommands.ts:31-36` (unchanged by C8) | `payment_methods` is not in `OWNER_UPSERT_KEYS`; ER-INTERFACE 1 says it is added. The page sends it anyway. | Any key-list check (parity matrix, a future client guard, the admin mirror test) disagrees with what the page sends. | Add `payment_methods` to `OWNER_UPSERT_KEYS` (and create keys) and the parity row. |
| EP-7 | major | `EventPage.tsx:153-158` + `OneEvent.tsx` `if (step && ws.data) return <EventStep>` | Pause / End / Resume go to the OLD step screens (`?do=`). One-off End reads "End event", the prototype says "Cancel the event" on a one-off (prototype line 523/618). The prototype's End sheet ("Coming dates come off the calendar. Past dates stay.") is not drawn. Pending changes are not saved or prompted before those links. | Live one-off: tap "End event" with a pending rename; rename lost; wording differs from v7. | Draw the End / Cancel the event / Resume confirm sheets on the page (like Stop and Delete already are) through `sendOne`, so pending changes are saved first; one-off label "Cancel the event". |
| EP-8 | minor | `EventPage.tsx:423` | Stop repeating offers only the first 8 coming dates. | Weekly event with 20 coming dates: cannot pick a last night after the 8th. | Show all coming dates (scrolling list) or a "Show all" row. |
| EP-9 | minor | `EventPage.tsx:200-202` | Third copy of the lifecycle tag (`shared/eventState.ts` `lifecycleTag` / `LIFECYCLE_WORD`, `selfServeApi.LIFECYCLE_LABEL`). Unknown statuses (`pending_review`, `rejected`) read "Archived" while the page stays editable. | A `rejected` series shows "Archived" with an Edit bar. | Use `lifecycleTag(status)` with the shared tone. |
| EP-10 | minor | `EventPage.tsx:240-245` vs `284-288` | Live with no coming date shows two "Add a date" links (card and dates section); the prototype card also offers End event there. | 18 prod live events with no coming date. | One Add a date; add End per prototype line 477. |
| EP-11 | minor | `eventPageModel.ts:301-302` | Comment says one-off "+ Add a date" only while none is coming; code shows it always. | A one-off with a date gets "+ Add a date"; adding one makes it two dates. | Decide (card says "always") and fix the comment, or gate it for one_off. Park the question. |
| EP-12 | minor | `EventPage.tsx:212` | Edit bar = Edit pill + 5 section buttons at 44px; at 390px it is wider than the screen and scrolls sideways inside the bar. | 390x844: "About" off screen. | Accept (prototype scrolls too?) or shorten; needs the browser walk to decide. |
| EP-13 | minor | `eventPageModel.ts:251-262` | The draft checklist recomputes the publish rule client-side (`blockers`) instead of reading `series_go_live_check_v1` via `shared/goLiveCheck.ts`, which the interface calls "the ONE publish rule". Flyer is checked by a separate field read. | Server adds a blocker (e.g. festival day with no timed session): checklist all done, Publish pressed, server refuses. | Drive the checklist from the go-live check result (map codes to the five rows), keep `blockers` only as the offline fallback. |
| EP-14 | minor | out-of-card edits | C8 also edited `__tests__/consistency*.tsx`, `fpar.review.test.tsx`, `parity-matrix.test.ts`, `shared/__tests__/eventRules.nofield.test.ts` (outside `events/__tests__/**`). All are removals of tests for things the card removed (time row, Put it back). Justified, but outside the card's file list. | -- | Note in the PR body. |

## Full control (every place that still says or enforces owner-only)

- `src/modules/organiser/events/eventPageModel.ts:273-287` -- `pageActions(..., owner)`; doc comment "End, Stop repeating and Delete draft are the owner team's: anyone else on the event only sees Pause."
- `src/modules/organiser/events/EventPage.tsx:95` (`const owner = role.loading || role.role !== null`), `:120`, `:357` (Resume only when `owner`). Note: today `owner` is true for any login with a seat on a page holding the series (owner OR manager), so the gate mostly bites when `useSeriesRole` returns null -- i.e. an accepted co-organiser whose page is not in the Home read. It flashes the full set while the role loads.
- Tests pinning owner-only: `events/__tests__/er-c8.model.test.ts` ("a co-organiser never gets End, Stop repeating or Delete draft"), `events/__tests__/er-c8.page.test.tsx:230-235`. Mutation proof: removing the gate turns exactly these two red.
- Not in C8's files but on the page's path: `events/organisersModel.ts:13` `MANAGER_REASON = 'Only the owner can change who runs this event.'` and `SeriesOrganisers.tsx:44,87` (C11's; reported here because EP-4 would mount it).
- Prototype v7 still has `isCo(e)` gates (lines 477, 526, 613) and "Every organiser can edit. Only the owner can end the event." -- superseded by the 2026-10-22 decision; do not build to those lines.
- Server: AD1 as built refuses end / stop repeating / delete draft / cancel one-off / set organisers for a co seat. Full control on screen needs that lifted server-side first (AD2 handover not readable from this sandbox).

## Rules owned by this slice

| Rule | Status | Where |
|---|---|---|
| 1 no time input | PASS (C8 files) | `eventRules.nofield.test.ts` offender `events/ProgrammeSheet.tsx` removed; Details time row gone |
| 7 one Update with scope count | PASS, with EP-2 / EP-5 | `eventPageModel.ts:179-197`, `EventPage.tsx:363-375` |
| 9 cancel a date / no Take this date off | PARTIAL | `DatesTakenOff.tsx`, `takenOff.ts` removed; cancel itself lives on the date screen (`ORG_PATHS.changeDate`), not audited here (dates family) |
| 11 optional details | PASS | description, music-style chips, photos, video editors (`EventPage.tsx:318-343`) |
| 12 Add how to pay nudge | PASS, with EP-3 | `eventPageModel.ts:65-70`, `EventPage.tsx:234-239` |
| 25 + Add a session, C4 card | PASS | `EventPage.tsx:248-263`, `applySessions` |
| D1 Event gaps | rename PASS, See it live PASS, + Add a date PASS, venue picker PASS, flyer change sheet NOT BUILT (links the old cover screen, parked), co-organisers NOT BUILT (EP-4) |
| D1 States | loading / not-found split / error PASS (`RebuiltEvent`); update failed PARTIAL (EP-2); leave-with-pending PARTIAL (EP-5) |
| D1 APPROVED | two save models PASS; Edit bar phone-only orange PASS; ended read-only with sentence PASS; weekday change not offered PASS |

Course and festival (owner decisions): the page offers no create, so "Course OFF / festival create" is not this slice's; a festival gets the common blocks only and ticket link as the only way to pay (`paymentCodes(format)`), festival blocks are C10's (parked by C8).

## Mounted?

Yes, behind the switch: `shell/OrganiserRoutes.tsx:93` `rebuildEnabled(VITE_ORGANISER_REBUILD, ...)` -> `RebuildSwitchContext` -> route `events/:seriesId` -> `OneEvent` -> `if (rebuild) return <RebuiltEvent>` -> `EventPage`. Exception: any `?do=` step (pause / resume / end / day) still renders the OLD `EventStep` even with the switch on (EP-7). Old `Details` / `Programme` / `SeriesOrganisers` screens still exist and are reachable only by URL with the switch on.

## Server as built

`series.upsert` with `payment_methods` (null clears, festival `ticket_link` only) matches AS BUILT apart from EP-6. `series.stop_repeating { keep_occurrence_ids }` is the existing command. Delete draft = `series.set_lifecycle archived`, matches "archive/delete a draft". Error text mapping: generic `flow.error`; the owner-only refusal text is not mapped to anything readable (moot once EP-1 is fixed server-side). `series_organisers_v1` is not called (owner detection still from the Home read). Server not landed on prod: everything above is NOT verified end to end.

## Shapes

Shape survey NOT run by this audit: the Supabase connector needs the owner to authorise it in this session. The C8 handover reports (read-only counts): live 67 (course 6, festival 7, one_off 10, recurring 44; 35 recurring with a rule), live without ticket link 16, paused 2, draft 2, ended 21, archived 653. Note ER-COMMON says draft 1 and archived 82 -- the numbers disagree and should be re-counted. From code: >100 dates handled (`readIsFull` -> "Updates your coming dates."); live with no coming date has a card (EP-10); closed events read-only with a sentence; no-organiser events (571) and two-organiser events (6) are not distinguished by the page at all (EP-1, EP-4); `pending_review`/`rejected` shapes mislabelled (EP-9).

## Tests

- `npx vitest run src/modules/organiser/events/__tests__/er-c8` -> 3 files, 85 passed (model 49, route 7, page 29).
- `npx vitest run src/modules/organiser` -> 128 files, 3670 passed, 2 skipped, exit 0.
- `npx eslint` on `EventPage.tsx`, `eventPageModel.ts`, `OneEvent.tsx`, `er-c8.*` -> exit 0. Raw Unicode punctuation in the new files: 0.
- Mutations: owner gate removed -> 2 red (they pin the WRONG behaviour, see EP-1); scope "keeping" count forced to 0 -> 3 red (live).
- Weak / vacuous: page test "a refused update keeps the changes and offers Try again" sets `h.error` BEFORE any action, so the error block shows as soon as the page is dirty; it never exercises a failed multi-command save and cannot see EP-2. The page tests mount `EventPage` directly, bypassing `RebuiltEvent`'s version key. Role `null` is called "a co-organiser" in tests but means "no seat" in `useSeriesRole`.
- Not run here: `npm run build`, `npm run lint` chain, `test:e2e` (C8 handover: build 0, lint 19/20 with `check:integrity` exit 126 for a missing exec bit).

## Design

From code only (no screenshots exist; C8 did no browser walk). Explicit px everywhere, tap targets 44px (`QUIET`, Edit bar buttons) or 52px rows. Possible sideways scroll in the Edit bar (EP-12). Long names truncate in the top bar; the big title wraps. Status tag colours use Ember tokens. Not seen: contrast, colour seams, clipping at 390x844, desktop two-pane.

## Dead code / duplication

- Lifecycle tag duplicated (EP-9).
- Publish rule recomputed on the client (EP-13).
- `seriesExtras.ts` price-list / usual-end helpers removed (good). `DatesTakenOff.tsx`, `takenOff.ts` removed with their tests (good).
- `events/Details.tsx` and old `OneEvent` body stay for switch OFF (expected until the switch is `*`).

## Verified / Not verified

Verified (this audit): the branch diff read in full for C8's page and model; mounting traced from the route; organiser test suite and C8 tests run green; eslint clean on C8 files; two mutations run; prototype v7 strings compared for actions and sheets.
Not verified: prod shape counts (Supabase not authorised here); AD2 handover and admin branches (no admin repo in this session); any server round trip; browser walk at 390x844 and real phone; `npm run build` and the full lint chain on the C8 branch; EP-2 is from reading the code (key + refresh), not reproduced in a test.
