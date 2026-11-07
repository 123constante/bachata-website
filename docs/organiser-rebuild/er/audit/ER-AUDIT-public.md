# ER-AUDIT: family `public` (slice ER-C6, branch `claude/er-c6-public`)

Audited 2026-10-22, read-only, ticket dt_98c62003061c. Brief: `ER-AUDIT.md` (sha 000dac13). Code audited:
`origin/claude/er-c6-public` head `f017b6b` (the C6 commit; it sits on the S1 commit `de7d0b4`, which is the
`rules-shell` family and is not judged here). Compared with `origin/main` `3a21361`.

Owner decisions applied (dispatch, 2026-10-22): calendar day row IN SCOPE (content only, density-exempt files: no
layout proposals); untimed sessions VALID on live series; rebuild switch per event; everyone on an event has full
control; public festival line-up does NOT read the new festival-artists storage.

## Verdict

| Slice / piece | Verdict | Why (one paragraph) |
|---|---|---|
| **ER-C6 as a whole** | **REBUILD** | Of the eight facts the card owns, only one new line (payment) is wired, and on the real payload shape it never prints: the public read sends `payment_methods` as a JSON array and the page drops anything that is not a string (P1). Festivals never reach the code at all: `/event/:id` hands every `format='festival'` event to `FestivalDetail.tsx`, and C6 only changed `BentoPage`, so "Timetable coming soon", the festival pay line and the festival byline cannot render (P2). The byline names only the first organiser while the organiser card on the same page lists all of them (P3). The workshop count reads `meta_data_public.program`, which no event served publicly has (P4). The calendar day row was left unwired (P5). The branch reds the perf-budget chunk ratchet on `/event/:id` (P6). The tests are pure-function tables with an oracle copied from the code under test, and they survive deleting the wiring (P9). The mapping file is small and worth keeping, but the slice has to be redone screen by screen against the real payloads. |
| `publicFacts.ts` (the shared mapping) | FIX (keep the file) | `paymentLine` and `organiserByline` are the right single home. Needed: take `string \| string[]`; byline from organiser order, not invented role data; delete `cancelledLine` (it copies `src/lib/utils.ts` `cancelledLabel` and disagrees with it); move `timetableSoon` onto the real session source. |
| `DescriptionBlock` / `BentoPage` wiring | REBUILD | It puts facts in the About tile only on non-festival pages, and nothing tests it. |
| Festival page (`src/pages/FestivalDetail.tsx`) | NOT BUILT | No pay line, no byline, no "Timetable coming soon". The "Nothing scheduled" empty day has a "Try another day above" hint. |
| Calendar day row (`CalendarListView.tsx`, `DayDetailModal.tsx`, `calendarUtils.ts`) | NOT BUILT | Parked by C6, now in scope. `DayDetailModal` shows "Cancelled" without the reason, while the list view shows it. There is no level and no byline, although the row already carries `primary_organiser_name`. |

## 1. Mounted?

- `/event/:id` -> `src/pages/EventPage.tsx:59` `useEventPage` -> `sniffIsFestival` (`src/modules/event-page/festivalEventQuery.ts:119-121`: `format === 'festival'` returns true) -> `EventPage.tsx:81-84` renders `FestivalDetail`, else `BentoPage`.
  - Non-festival: `BentoPage.tsx:483` -> `DescriptionBlock facts={pageModel.factLines}`: MOUNTED.
  - Festival: `FestivalDetail.tsx` does not import `publicFacts`/`factLines`: the C6 lines are UNMOUNTED for every festival. The prod sample has 1 public festival, and it has 2 organisers.
- Public facts are not behind `VITE_ORGANISER_REBUILD`/`rebuildSwitch.ts`: they ship to every visitor once merged. That is acceptable, because they only show stored values, but nothing records it as a decision.
- `cancelledLine`, `timetableSoon` (callable only through `publicFactLines`, which festivals never reach) and `EventInfoSection.tsx` (in `sections/`, no importer; it still renders the raw `paymentMethods` string): dead.

## 2. Plan rules owned by this family

| Rule / item | Status | Where |
|---|---|---|
| 18: payment choices on the event page | FAIL | Wired at `buildEventPageModel.ts:131-136` + `DescriptionBlock.tsx`, but the input is always null on the real shape (P1) |
| 18: payment on the calendar | NOT BUILT | `calendarUtils.ts:128` (parked) |
| 18: cancelled + reason, event page | PARTIAL | `DateBlock`/`CancelledRedStrip` use `publicCancelReason` (main code). `DatesBlock.tsx:74-79` coming-dates rows say "Cancelled" with no reason. The prototype `publicScreen` says "Cancelled: <reason>". |
| 18: cancelled + reason, calendar | PARTIAL | `CalendarListView.tsx:220` has the reason. `DayDetailModal.tsx:280-285` has none. |
| 18: level | PASS on the event page (main `ScheduleBlock.tsx:47-60`). NOT BUILT on the calendar row. | |
| 18: times from sessions | PASS on the event page (main ScheduleBlock and occurrence programme). On the calendar, times come from `party_start`/`class_start`/`key_times` (`calendarUtils.ts:221-222`); `has_timed_session` drives TBC. | |
| 15: festival party hours per day | PASS by main code: the `FestivalDetail` timetable lists each day's parties. C6 adds nothing. | |
| 15 / D1: "Timetable coming soon" (festival, no workshops) | FAIL | `publicFacts.ts:40-42`. Unreachable (P2), and the source is wrong (P4) |
| 15: artists as line-up | PASS (owner decision: public line-up stays on the existing `event_program_people` read, `useEventPage.ts:31`; no new storage read) | |
| CO-ORGANISING: "By <owner>, <co-organisers>" (accepted only) | FAIL | `publicFacts.ts:28-37` drops every co-organiser when role data is absent, which is always (P3) |
| 12 + owner override: no payment line when none | PASS | `publicFacts.ts:10-14` returns null (16 of 16 checked shapes; all 20 public events have `[]`) |
| D1: stored price list / event Instagram kept | PASS (untouched) | |

The brief says "rules 1-65", but the plan on `arc/briefs-organiser-r1` numbers only 1-29. This audit used 1-29 plus
the D1 / CO-ORGANISING sections.

## 3. Matches the server as built

- **payment_methods shape.** `event_view_p5(snapshot_compat)` returns `event.payment_methods` as a JSON **array**: 20 of 20 public events gave `list []`. The client reads it with `asString` (`useEventPageQuery.ts:21-23,196`), so any array, populated or not, becomes null. ER-INTERFACE section 1 describes the column as text (a comma list); the public read evidently serialises it differently. I could not see a populated row (none is public yet), so whether the elements are codes or labels is NOT verified.
- **Organisers.** AS BUILT: role/status live in `series_organisers_v1`, which only callers on the event and admins can use; the public snapshot has no `role`/`status`. Sample: 21 of 21 organiser rows carry neither key. C6's `role`/`status` parsing (`useEventPageQuery.ts:92-94`) therefore always yields null, and the code falls back to "first organiser only". AS BUILT also says invites live in their own table, so `organiser_ids` (what the snapshot lists) holds accepted pages only, with the owner as `organiser_ids[1]`. The right byline is therefore "all snapshot organisers, in order", provided `event_view_p5` keeps `organiser_ids` order. That order is NOT verified, because the admin repo is not reachable from this sandbox.
- **Cancel reasons.** The server list includes "Other". `publicCancelReason` (`src/lib/utils.ts:23-27`) hides "Other"; C6's `cancelledLine` prints "Cancelled: Other".
- **Festival artists.** Correctly not read (owner decision).
- ER-AD2.md: NOT READ. `add_repo 123constante/bachata-admin-11april` was refused ("you don't have access"). Server truth is from ER-INTERFACE AS BUILT only.

## 4. Shapes (read-only, public anon RPCs the site itself calls; counts only)

The Supabase connector needs owner authorisation, and the sandbox `SUPABASE_ACCESS_TOKEN` gave "Invalid access token",
so this survey used the public reads: `get_calendar_events_v2` (2026-10-22..2027-12-31) and `event_view_p5` per
event. Anon sees **20 distinct events** (the brief's 67 live includes events not on the public catalogue).

| Shape | Count | Screen handles it? |
|---|---|---|
| formats | recurring 17, one_off 1, course 1, festival 1 | festival: NO (P2) |
| payment_methods | 20 of 20 `[]` (array) | No line, which is correct today. Once populated, still no line (P1) |
| organisers per event | 1 org: 19; 2 orgs: 1 (the festival) | 2-org: byline wrong (P3), and never reaches the festival page anyway |
| organiser role/status keys | 0 of 21 rows | Fallback path is the only path (P3) |
| `meta_data_public.program` array | 0 of 20 | `workshopCount` always null, so the timetable line never fires (P4) |
| calendar rows | 819 rows (to end 2027); 381 to 2027-03-31 | |
| calendar rows untimed (`has_timed_session=false`) | 358 of 381 | Shows TBC (owner: untimed is valid). Worth an owner glance: 94% of rows say TBC. |
| cancelled calendar rows | 2, both without a reason label | "Cancelled" only, correct |
| two-organiser (brief: 6), no-organiser (571), draft, course 15, festival 12 | not visible to anon | NOT surveyed (needs the connector) |

## 5. Tests

- `npx vitest run src/modules/event-page src/modules/organiser/shared src/components/calendar`: 65 files, 960 passed, exit 0.
- `npm run test:unit`: 4 files / 15 tests fail, exit 1. All are live-DB contract or sandbox tests (`eventViewCompat`, `occurrenceProgram`, `publicEventPageLineup`, `integrityCouldNotRun`). C6's handover reports the same set.
- **Vacuous:** `publicFacts.test.ts` has a matrix (format x payment x workshops) whose oracle is `paymentLine(pay) !== null`, the function under test, so it cannot catch a wrong `paymentLine`. Every input is the string shape, never the array the server sends. The `buildEventPageModel` case only covers loading.
- **Mutation (run):** I replaced all three `<FactLines/>` in `DescriptionBlock.tsx` with `{null}` and passed `organisers: []` in `buildEventPageModel.ts`: **291 of 291 event-page tests stayed green**. Nothing renders a screen or builds a model from a ready snapshot with facts.
- No test touches `FestivalDetail`, the calendar row or the `DatesBlock` cancelled wording.

## 6. Design, contrast, tap targets

- The facts are plain `li` in the About tile at `text-[13px] font-semibold` with `--bento-fg` (`DescriptionBlock.tsx:13-19`). They inherit the tile's contrast, use px sizes and add no tap targets. When the body is empty, the tile now exists only for facts, titled "About" (`BLOCK_TITLES.description`); a pay line under "About" is a placement the prototype does not use. The prototype has its own "How to pay" card and a "By ..." line under the meta line, but the owner said the public layout stays unchanged.
- Copy: "Pay: Pay at the door, Cash" repeats "Pay". `bank_transfer` gives "Bank transfer beforehand" with no "message the organiser for details" line, which the prototype has.
- No `docs/design/` record for C6. NOT SEEN: no screenshots, no 390x844 walk (no populated public payload exists to render).

## 7. Dead code and duplication

- `cancelledLine` (`publicFacts.ts:45-49`) copies `cancelledLabel` (`src/lib/utils.ts:30-33`): a different separator (": " against " &middot; ") and it does not hide "Other". It has no caller.
- The "has workshops" fact has two sources: C6 counts `meta.program` types; the calendar counts `meta.program` with a different set (`calendarUtils.ts:158`: class/workshop, no masterclass); `ScheduleBlock` reads the real occurrence programme.
- `EventInfoSection.tsx` (in `sections/`, no importer) plus `eventInfo.paymentMethods` in the model (`buildEventPageModel.ts:64,266-269`): dead, a second payment display path.
- `/event` now pulls `src/modules/organiser/shared/eventRules.ts` (with `event-rules.json`) as its own chunk (`eventRules-*.js`), which is P6.

## Findings

| id | sev | file:line | what | failing scenario | fix in words |
|---|---|---|---|---|---|
| P1 | blocker | `src/modules/event-page/useEventPageQuery.ts:196`, `publicFacts.ts:10` | `payment_methods` is read with `asString`; the server sends an array | An organiser saves `ticket_link,cash`; the snapshot sends an array; the page shows no pay line | Parse `string \| string[]` in one helper shared with `parsePaymentMethods`; add a test on the real array shape; confirm a populated row's element form with the owner/AD |
| P2 | blocker | `src/pages/EventPage.tsx:81`, `src/pages/FestivalDetail.tsx` | Festivals render `FestivalDetail`; C6 wired only `BentoPage` | A festival with parties and no workshops shows "Nothing scheduled" day tabs, with no "Timetable coming soon", no byline and no pay line | Wire the same `publicFacts` lines into `FestivalDetail` (content only: the existing workshop/timetable area and the header meta) |
| P3 | major | `publicFacts.ts:28-37` | No role data means co-organisers are dropped; the organiser card on the same page (`OrganiserCardBlock.tsx:233`) lists all of them | The 2-organiser event: card shows A and B, byline says "By A" | Byline from all snapshot organisers in order (accepted-only by construction, owner = first); one function feeds both card and byline; confirm `event_view_p5` keeps `organiser_ids` order |
| P4 | major | `buildEventPageModel.ts:127-130` | Workshop count from `meta_data_public.program`, which 0 of 20 public events have | Line can never fire; once fixed for festivals, it would be wrong whichever way | Count workshop sessions from the same programme read the timetable draws (`useFestivalDetailQuery` schedule) |
| P5 | major | `calendarUtils.ts`, `DayDetailModal.tsx:280-285`, `CalendarListView.tsx` | Calendar row: no reason in the day modal, no level, no byline | A cancelled date with a reason: list says "Cancelled &middot; Bank holiday", modal says "Cancelled" | Content only: `cancelledLabel` in the modal; byline from `primary_organiser_name` (owner only, since co-organisers are not on the row, so ask the owner whether that is enough); level and pay need RPC fields (server ask) |
| P6 | major | `/event/:id` chunk ratchet | 44 first-load chunks against an allowance of 43 on the C6 branch (main: 43 of 43); KB 380.6 of 381 | `perf-budget.yml` `check:bundle-budget` exits 1 | Move the payment labels into the `lib-event-rules` group in `vite.config.ts`, or put the label map in a module that chunk already holds |
| P7 | minor | `publicFacts.ts:45-49` | `cancelledLine` copies and contradicts `cancelledLabel` | It prints "Cancelled: Other" | Delete it; use `src/lib/cancelLabel.ts` |
| P8 | minor | `DatesBlock.tsx:74-79` | Coming-dates rows show "Cancelled" without the reason | The prototype shows "Cancelled: reason" | Use `cancelledLabel(reason)` |
| P9 | major | `__tests__/publicFacts.test.ts` | Copied oracle, string inputs only, no screen tests; the mutation survives | Deleting the wiring stays green | Render tests of `DescriptionBlock`/`FestivalDetail`/calendar row over real payload shapes; fixed expected strings |
| P10 | minor | `publicFacts.ts:13` | "Pay: Pay at the door"; no bank-transfer follow-up | Reads clumsily | Owner copy pick: e.g. "How to pay: ..." and a bank line, per the prototype |
| P11 | minor | `sections/EventInfoSection.tsx`, `buildEventPageModel.ts:266-269` | Dead second payment path | A later worker might edit or revive it | Delete with the rebuild, after proving no importer |

## Full control (owner-only anywhere?)

None in this family. `src/modules/event-page/**`, `FestivalDetail.tsx` and the calendar files contain no "owner only"
or "owner team" copy, and no disabled or hidden control. The byline's `role === 'owner'` is ordering only.
`useEventPermissions` (creator / `event_permissions`, `src/hooks/useEventPermissions.tsx`) is legacy and creator-only,
but `pageModel.canEdit` is read only by the dead `sections/EventDraftBadge.tsx`, so no live public control depends on it.

## REBUILD would need (tell the fresh worker)

1. Festivals render `src/pages/FestivalDetail.tsx`, NOT `BentoPage` (`EventPage.tsx:81`). Every fact must be wired and tested on BOTH pages and on the calendar row.
2. Build on `origin/main` plus S1 (`eventRules.ts`); branch from the S1 branch, or wait for S1 on main.
3. Use real payloads: `payment_methods` is an ARRAY in `event_view_p5`; organisers carry NO role/status (AS BUILT: `series_organisers_v1` is not public). Byline = all snapshot organisers in order. Get one populated payment row confirmed (owner or AD) before writing the parser.
4. "Has workshops" comes from the programme the timetable draws, never `meta_data_public.program`.
5. Reuse `src/lib/cancelLabel.ts` for every cancelled string (event page dates, modal, list).
6. The calendar is in scope (content only). Level and pay on the row need server fields: ask, do not guess (keyword "payment" rpc: stop that part).
7. Tests: render tests over the real shapes, with fixed expected strings, red on the unwired code first; the perf ratchet (`node scripts/check-bundle-budget.mjs`) must be green before the push.

## CI steps run (sandbox, on `f017b6b`)

| Command | Exit |
|---|---|
| `npx vitest run src/modules/event-page src/modules/organiser/shared src/components/calendar` | 0 (960 passed) |
| `npm run test:unit` | 1 (15 live-DB/sandbox failures, same as C6 handover) |
| `npm run lint` | 1: only `check:integrity` failed, exit 126 (the file is mode 100644 on main too, sandbox); `bash bin/check-integrity.sh` exits 0; the other 19 links PASS |
| `npx eslint` on the 3 changed source files | 0 |
| `npm run build` | 0 |
| `node scripts/check-bundle-budget.mjs` | **1** (chunk ratchet `/event/:id` 44 > 43); main `3a21361`: 0 |
| `node scripts/check-first-load-requests.mjs` | 0 |
| `npm run check:seo` | threw in `previewProbe.assertMeasured` (needs a live preview) |
| `check:og` | NOT RUN (needs a live deploy) |

## Verified / Not verified

Verified: the festival routing (code); the payment array shape and the absence of organiser roles on 20 public events
(live public read); the perf ratchet red on the C6 build and green on the main build; the test vacuity, by mutation;
the cancelled wording split (code).

Not verified: ER-AD2.md (admin repo inaccessible); the order of `event_view_p5` organisers; a populated
`payment_methods` element form; shapes anon cannot see (draft, 571 no-organiser, 6 two-organiser, course 15 and
festival 12 per the brief); screenshots or a 390x844 walk; `check:og`/`check:seo` (no live preview); Vercel (token
present but not needed for a docs-only audit).
