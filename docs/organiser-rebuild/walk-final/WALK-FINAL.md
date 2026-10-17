# WALK-FINAL (R-INT-C): final 390x844 walk of PR #809 after the F-INT fix pass

**Verdict: 1 BLOCKING / 1 SHOULD / 6 NOTE**

Walked head `e04dea0` (`claude/org-r1-integrate`) as a production build (`npm run build`, served by
`scripts/_serve-build.mjs` on :4173), driven by Playwright at 390x844 against
`tests/e2e/helpers/organiserFake.ts`. The walk re-uses the INT-B specs (`walk-INT/walk-int.spec.ts.txt`),
now saved here as `walk-final-grid.spec.ts.txt`. The 10 new checks are in `walk-final-items.spec.ts.txt`.
Raw output is in `measure.jsonl` (105 grid cells) and `items.jsonl`. No source file was changed.

## Findings

### BLOCKING

- **B-1. "Cancelled" never comes first on prod: `organiser_home_v1` does not return `cancelled_upcoming_count`.**
  `src/modules/organiser/jobs/homeJobs.ts:64-65` (`cancelledOnly`) reads `series.cancelled_upcoming_count`.
  `homeModel.ts:35-38` says this comes from "home_v1 v2, R3-3". On prod, a read-only check on 2026-10-17 found
  that `pg_get_functiondef` of `public.organiser_home_v1` does not contain `cancelled_upcoming_count`. The only
  prod function that mentions it is `_cmd_occurrence_cancel_p5`. On prod the field is `undefined`, so
  `undefined > 0` is false and a cancelled-only event still reads "Needs a cover" or "Needs dates". The e2e fake
  does not serve the field either, which is why the walk shows the same failure (`states__events.png`,
  `states__home.png`: "Cancelled one-off: Needs a cover"). INT-B N-9 is therefore still open.
  **Fix:** either apply the admin home_v1 v2 migration that adds `cancelled_upcoming_count` before this ships,
  or derive the count on the client from `next_dates` (and default a missing field to 0 when parsing). Also
  make the fake serve the field, so the e2e covers it.

### SHOULD

- **S-1. `festivalHeld` gets NaN on prod for the same reason.** At `src/modules/organiser/flows/add/addModel.ts:86`,
  `series.upcoming_count + series.cancelled_upcoming_count` evaluates to `n + undefined`, which is NaN, so the
  check is never true. Without the workspace, a festival that already holds a date is not blocked on the
  which-event step (C7). It is still caught at C8, so the cost is a wasted tap and not a bad write.
  **Fix:** the same as B-1. Default a missing count to 0 in the home parse.

### NOTE

- **N-1. Site footer links are under 44px on every organiser screen.** They are 14px high: Parties, Classes,
  weekday links, Privacy, Terms and others (`measure.jsonl`, `small`). This is site chrome below the organiser
  shell, unchanged by #809. It was excluded from the organiser verdict.
- **N-2. The fake does not serve `dancer_area_gate_v1`.** The fake's default answer is `[]`, which logs
  "dancer_area_gate_v1 returned an unexpected shape" to the console on 104 of 105 cells. This is a fake gap,
  not an app defect. It does mean "console clean" could not be shown on the fake. Fix it in the fake.
- **N-3. The fake's `organiser_team_search_people_v1` returns `[]`.** `/team/add?q=Priya` prefills "Priya"
  but shows "No one found". This is a fake limitation, not an app defect.
- **N-4. The role help says "Only the owner removes people..." even when the team has two owners.** See the
  default shape, Person screen (`team__default__person_other.png`). "An owner" would match what the screen
  shows.
- **N-5. Archived events are not listed on My events.** For that reason the 7-value chip check compares 6
  values across both screens. On One event, an archived event shows the closed line "This event is archived..."
  (`status__events_ID_archived.png`). If hiding archived events on My events is intended, this is fine.
- **N-6. On the no-access screen of new/:id/date, Back goes to new/:id/venue,** which is the same refused
  event. Back works, but it goes one step back inside a flow the person cannot use. "Back to Home" may serve
  better here.

## Screen x shape grid (W = walked and measured on the prod build; R = read in code only)

Shapes: `default` (2 series, a team of 3, 2 join requests), `zero_team1`, `one_team1`, `ten_team5`
(12 series, a team of 5), `states` (ended weekly with `ended_on`, paused weekly, cancelled-only one-off,
3-day festival, 3-date course, a team of 2). Every cell had no horizontal scroll, no control covered by a
sticky bar, no organiser control under 44x44 (see N-1), no clipped text (the sr-only weekday spans are 1px by
design), no page error, and no keyboard-open field below the 336px fake keyboard.

| Screen | default | zero_team1 | one_team1 | ten_team5 | states |
|---|---|---|---|---|---|
| Home | W | W | W | W | W, B-1 |
| My events | W | W | W | W | W, B-1 |
| One event | W | W, no access (no such event) | W | W | W (ended) |
| Details | W | W, no access | W | W | W |
| Team | W | W | W | W | W |
| Team / add | W | W | W | W | W |
| Team / person (me) | W | W | W | W | W |
| Handover | W | W | W | W | W |
| /page | W | W | W | W | W |
| More | W | W | W | W | W |
| More / help | W | W | W | W | W |
| Switch | W | W | W | W | W |
| Change (which event) | W | W "No events yet" | W | W | W |
| Change / event | W | W, no access | W | W | W (ended line) |
| Add (which event) | W | W "No events yet" | W | W | W |
| Add / event | W | W | W | W | W (ended line) |
| Cancel (which event) | W | W "No events yet" | W | W | W |
| Cancel / event | W | W | W | W | W (ended line) |
| New / what | W | W | W | W | W |
| New / name | W | W | W | W | W |
| Cover | W | W, no access | W | W | W |
| Public organiser page pencils | R | R | R | R | R |

Screenshots are named `<shape>__<screen>.png`, where `ID` is the event id. Keyboard-open shots are `__kb.png`.

## The 10 fix-pass items

| # | Item | Result | Evidence |
|---|---|---|---|
| 1 | No-access on One event, Details, Cover, Cancel which-date, Cancel confirm, Add which-day, Add time, Change time and New first date | **PASS** | `noaccess__*.png`. On all 9 screens: the title is "You do not have access to this event", there is no Retry button, Back navigates (each before and after path is in `items.jsonl`), and there are no page errors. See N-6. |
| 2 | "No events yet" plus New event, and "No coming dates" | **PASS** | `zero_team1__change.png`, `__add.png` and `__cancel.png` show "No events yet / New event". A page whose events are all past (`allpast__*.png`) shows "No coming dates / Add a date" on Change, Change/event and One event, and "No dates to cancel / Add a date" on Cancel. |
| 3 | Full weekday and month names in truncating rows, and `line-clamp-2` row heights | **PASS** | `rows__ten_team5_longnames__events.png`: all 12 rows are 56px and long names clamp to 2 lines with an ellipsis. Join-request lines read "Asked Saturday 3 October to join" on one line (`default__team.png`). Coming dates read "Friday 9 October, 20:00". The clipped detector found nothing in any cell. |
| 4 | One event month grid | **PASS** | `grid__default__events_ID.png`. The weekday header is M..S, and the sr-only names "Monday".."Sunday" are in the accessibility tree. Each date carries sr text "on" or "cancelled" (the tree reads "16 cancelled", "23 on"). On screen, scheduled dates have a gold dot and cancelled dates a grey dot, and the Cancelled section is listed separately. |
| 5 | Status chip words for the 7 lifecycle values | **PASS (6 of 7 comparable)** | `status__events.png` and `status__events_ID_<value>.png`. Draft = "Draft", pending_review = "In review", rejected = "Changes needed", paused = "Paused", ended = "Ended", live = its first problem ("Needs a cover"). Each word is identical on both screens. Archived is not listed on My events (N-5). |
| 6 | Team | **PASS** | No "Make owner" anywhere. The role help contains no "review". An empty filter shows "No one found. Share an invite link below." (`team__default__team_add_empty_filter.png`). A search error shows "We could not search just now. Retry" (`team__default__team_add_search_error.png`). After Remove, "Add them back" goes to `/team/add?q=Ana%20M.` with the search prefilled (`team__default__add_them_back.png`). `/team/add?q=Priya` prefills (`team__default__team_add_q.png`). "Leave this page" is present on More, and on Team and Person for non-owners (R: `team/index.tsx:81`, `Person.tsx:97`). |
| 7 | /page pencils | **PASS** (/page W, public page R) | All nine /page pencils are 44x44, including Edit city, Edit year started and Edit category (`pencils__default__page.png`). On the public page, `.eip-pencil--compact` stays 32px wide outside `.org-theme` (`edit-in-place/parts.tsx:20-21,39`), so it is 32x44 and unchanged (read only). |
| 8 | Focus return | **PASS** | Details: a real click on the Venue row opens the sheet. After Escape, `document.activeElement` is the "Venue Studio One" link that opened it. Sign out: a real click opens the sheet (`focus__default__signout_sheet.png`). After the close button, 0 dialogs remain and focus is on the "Sign out" row button. |
| 9 | Cancelled-only event reads Cancelled first | **FAIL** | `states__events.png` and `states__home.png` show "Cancelled one-off: Needs a cover". See B-1: prod `organiser_home_v1` lacks the field this depends on. |
| 10 | Keyboard open (fake 336px viewport) | **PASS** | Add someone search sits at 79-127, inside the 508px visible height (`kb__default__team_add.png`). DateSheet name with "Bad <name>": the row shows "Needs a fix before saving" (`kb__default__date_needs_fix_row.png`). Reopened, the field sits at 240-288 inside 508, with `aria-invalid="true"` and `aria-describedby` resolving to "The name cannot contain < or >." (`kb__default__date_sheet_name_error.png`). |

Copy check: the same fact reads the same across screens. Examples: the "Needs a cover" chip on Home, My events
and One event; the ended line on One event, Change, Add and Cancel; the NoAccess copy on 9 screens. No text
pointed at a control that was not on screen.

## Verified / Not verified

**Verified**
- The production build of `e04dea0`, walked at 390x844 in Chromium: 105 grid cells plus 23 item checks, all
  measured (horizontal scroll, under-44px controls, sticky-bar coverage, clipped text, page errors, console,
  keyboard-open).
- Prod facts checked read-only through the Supabase SELECT on `pg_proc`: `organiser_home_v1` has no
  `cancelled_upcoming_count` (B-1). No write was made.

**Not verified**
- No real iPhone or Android, no real on-screen keyboard (a fake visualViewport only), no VoiceOver or TalkBack.
  Accessibility was read from the Playwright accessibility tree.
- Fakes, not live RPCs. The fake shapes mirror the 2026-10-17 prod survey but are not prod rows. The fake
  lacks `cancelled_upcoming_count`, `dancer_area_gate_v1` and team search results (N-2, N-3).
- The public organiser page pencils were read in code, not walked: SSR routes 500 with the placeholder key.
- Vercel preview: not opened (no login page used).

## Commands run

```
git fetch origin arc/briefs-organiser-r1 claude/org-r1-integrate claude/org-r1-review-INTB
git checkout -B claude/org-r1-walk-final origin/claude/org-r1-integrate
VITE_SUPABASE_URL=https://stsdtacfauprzrdebmzg.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=<e2e placeholder from e2e-smoke.yml> VITE_ENABLE_ORGANISER_SELF_SERVE=true npm run build
node scripts/_serve-build.mjs --port 4173
VITE_SUPABASE_URL=https://stsdtacfauprzrdebmzg.supabase.co npx playwright test tests/e2e/walk-final-grid.spec.ts --workers=4
VITE_SUPABASE_URL=https://stsdtacfauprzrdebmzg.supabase.co npx playwright test tests/e2e/walk-final-items.spec.ts --workers=2
Supabase (read-only): SELECT over pg_proc / pg_get_functiondef for organiser_home_v1 and cancelled_upcoming_count
```

Trap for the next walker: the sandbox environment sets a different `VITE_SUPABASE_URL`. If the test process
does not pin it to the project the build used, the fake writes its session under the wrong localStorage key
and every screen redirects to /auth. The first run hit this and was discarded.
