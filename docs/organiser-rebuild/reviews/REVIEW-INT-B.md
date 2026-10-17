# REVIEW-INT-B -- whole-diff review of PR #809 (organiser R1, integrated): UX copy and accessibility

Reviewer branch `claude/org-r1-review-INTB`, cut from `claude/org-r1-integrate` head `8dffd70c`. Brief `briefs/R-INT-B.md` (branch `arc/briefs-organiser-r1`); method copied from `REVIEW-S7.md`. The only changes on this branch are this file and `walk-INT/` (screenshots, the walk's raw measurements, and the two walk specs saved as `.txt` so the walk can be re-run). No source file was touched.

Stopping rule (stated before the round): ONE pass, scope = UX copy + a11y, phone first. Findings go to the fix worker; the reviewer does not fix.

## Verdict: 2 BLOCKING / 10 SHOULD / 11 NOTE

The production build was walked at 390x844 across 5 prod shapes x 21 organiser routes (105 cells, all passed; see the grid). No cell scrolls sideways. No sticky bar covers a control. No page error was thrown. Every field the walk reached stays above a 336px keyboard. There are two blockers. A raw database enum shows as a status chip, and it is reachable as soon as someone sends an event for review. Separately, the PR's red `build-smoke` check reproduces here; it comes from a stale test id, not from a product defect.

---

## BLOCKING

**B-1. My events and One event show the raw enum `pending_review` / `rejected` as the status chip.**
- Where: `jobs/homeJobs.ts:61` and `:69`. `LIFECYCLE_CHIP` has only `live/paused/ended/archived`, and the fallback is `?? series.lifecycle_status`.
- Why it matters: `seriesChip` is the chip on `events/EventList.tsx:18` (My events) and `events/OneEvent.tsx:169` (One event header). An event that has been sent for review (the launch walk's step 3, "In review") or rejected, and that has no Home problem, therefore shows `pending_review` or `rejected` to the organiser.
- Prod today: 0 organiser-owned series are in either state (survey below). Every Send for review creates one.
- Fix: return `lifecycleTag(series.lifecycle_status).label` from `shared/eventState.ts:43` instead of the local partial map. This also clears S-2.
- Evidence: a scratch vitest (not committed) calling `seriesChip` with an empty series of each status:
  ```
  npx vitest run src/modules/organiser/__walkint
  CHIP pending_review => pending_review
  CHIP rejected => rejected
  CHIP archived => Archived
  CHIP paused => Paused
  ```

**B-2. `build-smoke` is red on the PR, and this reproduces locally: 3 of 66 fail, all because the end screen expects `home-dates`, a test id the R1 Home no longer renders.**
- Where: `tests/e2e-build/public-journeys.build.spec.ts:40,42,43`. The journeys are `organiser-link-organiser-signed-in` (M14), `signin-unfinished-dancer-with-organiser` (M35) and `team-invite-existing-dancer` (M53).
- `grep -rn "home-dates" src` finds 0 hits. R1 Home is `org-page-home` (`home/index.tsx:144`) with `home-job` rows.
- Why it is blocking: the PR check is red, and the brief's DoD needs green checks.
- Out of this review's UX scope, but this is the cause of the red check.
- Fix: point those three END screens at `org-page-home`. For M35, also re-check the expected label, since its hops now pass through `/finish-profile` and `/app/welcome` before reaching `/account/o`.
- Evidence: `npx playwright test --config playwright.build.config.ts` gives `3 failed, 63 passed (5.3m)`, each with `Locator: getByTestId('home-dates') ... element(s) not found`.

## SHOULD

**S-1. Dates use short weekday and month names, against the common rule "Full weekday and month names in copy (Friday, October)".** The rule is `00-COMMON.md:15`.
- `shared/homeModel.ts:59-60` (`WEEKDAY = ['Sun','Mon',...]`, `MONTH = ['Jan',...]`) feeds `calendarDate`/`dateLabel`. Those drive the Home job lines, the editor rows (`events/eventModel.ts:267,281`), `dateCap.ts:156`, and `eventState.ts:63`. The walk shows "Ended on Sat 5 Sep" in `walk-INT/states__events_ID.png`.
- `shared/teamModel.ts:153` and `ui/londonDate.ts:20` use `weekday: 'short'`. The first dates the join request; the second is DateChip's screen-reader label.
- Meanwhile `shared/dateList.ts:25` `dayLabel` uses full names, so the same date reads two ways on two screens.
- Fix: one full-name formatter in `shared/`, used by every one of these sites.
- Evidence: `grep -rnE "weekday: *'(short|narrow)'|'(Mon|Tue|Wed|Thu|Fri|Sat|Sun)'" src/modules/organiser --include=*.ts --include=*.tsx | grep -v __tests__` gives 5 short-name sites.

**S-2. The status words exist three times.**
- The three copies: `shared/eventState.ts:26` `LIFECYCLE_WORD`, `shared/selfServeApi.ts:448` `LIFECYCLE_LABEL` (a test pins it equal to the first), and the partial `jobs/homeJobs.ts:61` `LIFECYCLE_CHIP`, which is the cause of B-1.
- There are also inline literals: "Live" at `page/index.tsx:84` and `switch/index.tsx:69`; "Draft" at `flows/add/WhichEvent.tsx:37`; "Cancelled" at `events/EditorRows.tsx:87`.
- Fix: keep `LIFECYCLE_WORD`/`lifecycleTag` as the only source and import it everywhere. The CLAUDE.md DoD says "One shared mapping for any fact shown on more than one screen".

**S-3. "Leave this team" leads to a screen whose control is called "Leave this page".**
- `team/index.tsx:82` and `team/Person.tsx:85` link to `ORG_PATHS.more`, where the row and sheet read "Leave this page" (`more/index.tsx:103,127`).
- Fix: label both links "Leave this page".

**S-4. A page with no events gets a two-hop dead end on Change.**
- `flows/change/WhichEvent.tsx:23` shows "No coming dates" with **Add a date**. That leads to Add, which says "No events yet" with **New event** (`flows/add/WhichEvent.tsx:23`). The same fact gets two wordings, and the first button cannot work for this page.
- Walk: `walk-INT/zero_team1__change.png` and `zero_team1__add.png`. Prod: 2 of 46 pages have 0 series.
- Fix: when the page has no series at all, Change (and Cancel, `flows/cancel/WhichEvent.tsx:23`, read only, not walked to the button) show "No events yet" with **New event**. Keep "No coming dates" for a page whose events have no future dates.

**S-5. Add someone: two dead ends in the results.** Both are in `team/AddSomeone.tsx`.
- (a) `:110-120`: when every search hit is already on the team, the list renders nothing at all. The rows are filtered by `memberIds`, but "No one found. Share an invite link below." checks the unfiltered `search.data.length === 0`. Fix: test the filtered list.
- (b) `:109`: "We could not search just now. Try again." There is no retry control on screen. The line is also not announced (a plain `<li>` with no `role="alert"`). Fix: add a Retry button that calls `search.refetch()`, and give the line `role="alert"`.

**S-6. One event's month grid has no weekday header, and each date's state is hidden from screen readers.**
- `events/OneEvent.tsx` `MonthDots` (`:33-43`) renders bare day numbers in a Monday-first 7-column grid. No M T W T F S S row is shown, so a sighted user has to guess the weekday.
- The dot that carries the state (scheduled or cancelled) is `aria-hidden` with no text alternative.
- Walk: `walk-INT/states__events_ID.png`, `default__events_ID.png`.
- Fix: add a weekday header row, plus an sr-only "cancelled" or "on" per marked date.

**S-7. My events truncates names to about 163px beside the chip, so similar names become indistinguishable.**
- The `EventList` row title is `truncate`. With a "Needs a cover" chip, the title gets 163px of 390 (the walk measured `280>163` on 11 rows; see `walk-INT/ten_team5__events.png`).
- Prod: 33 of the 74 open (live/draft/paused) organiser-owned series have names longer than 18 characters.
- Fix: `line-clamp-2` on the title instead of `truncate`. The Home job title (`home/index.tsx:44`) truncates too, measured `292>280`.

**S-8. Focus is lost after sheets and confirms close.** These come from the code read; the walk does not exercise focus.
- (a) `ui/SheetView.tsx:38-43` has a `returnFocusRef` prop that no caller passes (`grep -rn returnFocusRef src/modules/organiser --include=*.tsx | grep -v ui/SheetView | wc -l` gives `0`). Callers: `events/EditorSheet.tsx:303`, `dates/DateSheet.tsx:136`, `home/onboarding/OrganiserSheet.tsx:175`, `more/SignOutSheet.tsx:22`. On iOS Safari a tap does not focus the button, so the recorded opener is `body` and VoiceOver restarts at the top of the page. This is PLAUSIBLE: traced, not run on iOS.
- (b) `team/Person.tsx:88` is an inline `role="alertdialog"` with no focus handling. Both "Remove from the team" and "Keep them" unmount the focused button.
- (c) The leave-guard at `edit-in-place/EditInPlaceLayer.tsx:507` handles Escape only. It has no Tab trap, and "Stay here" drops focus to `body`.
- Fix: pass the opener ref at each SheetView call site; make (b) `role="group"` and move focus into it, then back to Remove; use `trapTab` from `sheetStyles.ts` in (c) and refocus the previous element in `stay()`.

**S-9. Field errors are not tied to their inputs.**
- `ui/Field.tsx:26` renders `<p role="alert" data-testid={noteId}>`. The id lives only in `data-testid`, so nothing can reference it.
- The one caller that passes `error`, `dates/DateSheet.tsx:182-192`, leaves its `<input>` without `aria-invalid` or `aria-describedby`.
- The edit-in-place sheets already do this right (`FieldSheet.tsx:172-173`).
- Fix: put `id={noteId}` on the note and wire `aria-invalid`/`aria-describedby` on the control.

**S-10. Team copy contradicts itself and uses "organiser" where the owner chose "page".**
- `shared/selfServeErrors.ts:229`: "Only an owner of this organiser can do that. As a manager you can leave the team."
- `:242`: "As a manager or contributor you can see the team and leave it."
- `team/Person.tsx:14` `ROLE_EXPLAINER`: "Owners and managers add people."
- The team-less empty state, `team/index.tsx:56`: "You don't run an organiser yet. A team belongs to an organiser..."
- Fix: say "page" in these, and make the error copy match `ROLE_EXPLAINER` (managers add people).

**S-11. A removed session's grey type chip falls below AA.**
- In `dates/index.tsx:310-312`, the row is faded to `opacity-[.72]`. The neutral `StatusTag` (`--mut` on `--card2`) inside it then computes to 3.79:1 at 12px.
- The row's own muted text was already switched to `--fg` for exactly this reason (comment at `:315`).
- Fix: give the chip `--fg` on removed rows, or drop it there.

## NOTE

- **N-1 (known, holds) "Make owner".** The string is still present at `shared/selfServeErrors.ts:243` and `edit-in-place/teamPickerModel.ts:159`. No "Make owner" control renders anywhere. The consistency matrix passes anyway (`npx vitest run src/modules/organiser/__tests__/consistency.render.matrix.test.tsx`: 34 passed, 2 skipped), because its `not.toMatch(/Make owner/)` (`:294`) scans rendered screens, not error copy. A third copy at `src/modules/admin-organisers/inviteModel.ts:224` is pre-existing on `main` (blame 59f693c7), not in this PR, and should be fixed with the other two. Suggested wording: "add them as a Manager, then open their name and tap Hand the page over".
- **N-2 (known) /page pencils.** The walk measured exactly three controls on /page below 44px, each `32x44`: Edit city, Edit year started, Edit category (the compact pencil, `edit-in-place/parts.tsx:35`). They are already being fixed. Nothing else on /page is below 44 in any of the 5 shapes. The only other sub-44 element in the module is the sr-only cover file input (`1x1`, `aria-hidden`, `tabIndex -1`).
- **N-3 Site footer under every organiser screen.** 20 footer links (Parties, Monday..Sunday, Privacy, Terms, and the rest) are 14px tall and render below every organiser screen (105 of 105 cells). This is pre-existing site chrome, outside the module. Inline text links in the module (`team/AddSomeone.tsx:98,100`, `team/Person.tsx:64`, `flows/handover/Confirm.tsx:52`, `home/onboarding/OnboardingView.tsx:142`) do not use the repo's `tap-link-inline` (44px) pattern. WCAG 2.5.8 exempts in-sentence links.
- **N-4 Walk results (production build).**
  - Horizontal scroll: `0` in 105 of 105 cells.
  - Sticky or fixed bar covering a control's centre point (an `elementFromPoint` test): 0 in 105 of 105.
  - `pageerror`: 0.
  - Keyboard open (fake 336px visualViewport): every field reached was inside the visible 508px and hit-tested to itself, with Done still on screen. That covered Add someone search, 6 /page sheets (name, city, year started, about, Instagram, Facebook) and the session sheet's name, start and end. Raw data is in `walk-INT/kb.jsonl` and `measure.jsonl`.
- **N-5 Contrast (computed from `theme.css:11-30`; the theme is dark only).** `--mut` #a39a8b reads 6.98 on bg, 6.42 on card, 5.89 on card2 and 6.24 on sheet. `--ph` #8f8678 is 4.56 at its lowest (card2): it passes, narrowly. The only failure is S-11.
- **N-6 Reduced motion.** The module honours it (`theme.css:82-92`, `motion.ts:10`, `Buttons.tsx:43`), and the walk ran with `reducedMotion: 'reduce'`. Two exceptions: the shared `EmailCodeProof.tsx:120,129` and `PublicClaimCard.tsx:254,287,330` spinners (`Loader2 animate-spin`) render outside `.org-theme` and have no `motion-reduce:animate-none`.
- **N-7 Wording drift.**
  - "coming dates" (6 sites, e.g. `OneEvent.tsx:80`) vs "upcoming dates" (17, e.g. `EditorRows.tsx:98`).
  - "Put back" / "Put it back" / "Put this date back on" (`DatesTakenOff.tsx:54`, `OneEvent.tsx:97`, `dates/index.tsx:234`).
  - "Press Resume" (`editorGuards.ts:105`), where everything else says "Tap".
  - "Reload the page" (5 hits in `selfServeErrors.ts`) is ambiguous now that "page" means the organiser's page.
- **N-8 Raw Unicode punctuation in TS string literals.** There are 10 hits, against the CLAUDE.md mojibake rule: `teamModel.ts:174`, `selfServeErrors.ts:244,282`, `contactModel.ts:60`, `teamPickerModel.ts:74,76,78,89`, `DatesTakenOff.tsx:54`. Command: `LC_ALL=C.UTF-8 grep -rnP '[\x{2014}\x{2026}\x{2018}\x{2019}\x{201C}\x{201D}]' src/modules/organiser`. Without the locale, grep errors and reports 0.
- **N-9 A one-off whose only date is cancelled reads "Needs a cover" on My events.** The first problem wins, so the cancelled fact is not on the list (`walk-INT/states__events.png`). Consider letting a cancelled-only event outrank the cover problem.
- **N-10 (PLAUSIBLE, not run) The edit-in-place "we will show: ..." notice may show a city UUID.** `EditInPlaceLayer.tsx:327` builds it from `fieldInPatch(sent, k)`, and for the city field (`fieldRules.ts:158` `CITY_ID`) that value is an id.
- **N-11 "organiser" in onboarding copy.** It still appears ("Your organiser", "1 organiser found", "An organiser"; `home/onboarding/OnboardingView.tsx:102,123,132,187`; `switch/index.tsx:18` aria-label). The context is claiming a listing, so it may be intended; the owner should confirm against the "Add a page" decision.

## Screen x shape grid

Shapes were fed through `tests/e2e/helpers/organiserFake.ts`, built to the prod survey:
- `default`: 2 series, a team of 3, 2 join requests.
- `zero_team1`: 0 series, a team of 1.
- `one_team1`: 1 open weekly series, a team of 1.
- `ten_team5`: 12 series, a team of 5.
- `states`: ended weekly with `ended_on`, paused weekly, a cancelled-only one-off, a 3-day festival, a 3-date course; team of 2.

Routes walked for every shape (W = walked and measured on the production build):

| route | default | zero_team1 | one_team1 | ten_team5 | states |
|---|---|---|---|---|---|
| Home `/` | W | W | W | W | W |
| `events`, `events/:id`, `events/:id/details` | W | W (id absent: "Event") | W | W | W (id = ended) |
| `team`, `team/add`, `team/:me` | W | W | W | W | W |
| `handover` | W | W | W | W | W |
| `page`, `more`, `more/help`, `switch` | W | W | W | W | W |
| `change`, `change/:id`, `add`, `add/:id`, `cancel`, `cancel/:id` | W | W | W | W | W |
| `new/what`, `new/name` (redirects to `what` without state), `cover/:id` | W | W | W | W | W |

What was only read in code, not walked:
- the change, add and cancel steps past the date picker (time, venue, day, confirm);
- the New flow past step 1;
- Handover confirm;
- a non-self `team/:userId`;
- the DateSheet for the paused, festival and course dates;
- the email-differs / "Ask to join" claim path;
- the sole-owner Leave reason.

Kept screenshots: all 21 routes for `default`, plus home, events, one event, details, team, change, cancel, add, handover and page for every other shape, plus 3 keyboard-open shots. The full 105-cell measurements are in `walk-INT/measure.jsonl`.

## Prod shapes (read-only SELECT, counts only, `stsdtacfauprzrdebmzg`, 2026-10-17)

- Organiser-owned series by `lifecycle_status` x `format`:
  - live: recurring 44, one_off 10, festival 7, course 6
  - draft: recurring 6
  - ended: recurring 12, course 8
  - paused: recurring 1
  - archived: 81
  - `pending_review` and `rejected`: 0 (see B-1)
- Open series (live/draft/paused): 74. Of those, 33 have names longer than 18 characters and 8 longer than 30 (S-7). 5 have no cover.

## CI (PR #809 head `8dffd70c`)

| job | PR check | run locally here |
|---|---|---|
| unit (London full, New York, Sydney) | success | partly: the consistency matrix, 34 passed |
| e2e-smoke | success | not re-run in full |
| integrity, bundle-budget, contract-check, live-db-gate, canary x3, bom/masking/notification-check, dancer-area-isolation, wallclock-brand, phone-qa | success | no |
| build-smoke (phone-qa.yml, production build, `playwright.build.config.ts`) | **failure** | **reproduced**: 3 failed, 63 passed (B-2) |
| real-data-verified | **failure** | no: it reads the PR body |
| phone-qa-section | **failure** | no: it reads the PR body |
| seo, og, lighthouse, synthetic, doc-weight, measure | skipped | n/a |

The build-smoke job log fetched through the GitHub MCP shows only the post-job cleanup tail. The local run of the same config identifies the cause (B-2). That run rewrites tracked screenshots under `docs/review-packs` and `docs/handover`; they were restored and are not committed.

## Verified / Not verified

Verified:
- `npm run build`, production, exit 0. The build used CI's e2e env (`VITE_ENABLE_ORGANISER_SELF_SERVE=true` and the placeholder key). Without that flag `/account/o/*` redirects to `/` by design (`AnimatedRoutes.tsx:235`). That is not a defect.
- The 105-cell walk at 390x844 on that build, served through `@react-router/node` (`createRequestListener`): reduced motion on, tap-target, horizontal-scroll, covered-control and clipping measurements, and a keyboard-open probe on 10 fields.
- B-1 by a scratch unit test.
- S-5(a) by reading the code path (`AddSomeone.tsx:110-120`).
- The prod counts above.

Not verified:
- Behaviour on a real iPhone or VoiceOver (S-8a is PLAUSIBLE).
- Focus order, measured in a browser. Focus findings come from the code read.
- Motion with reduced motion OFF.
- The flows past their first step (see the grid).
- N-10.
- The known-context items "Ask to join" for email_differs/managed, the S6 manager-add A1b dependency and the sole-owner Leave rule: assumed, not re-checked.
- Every remaining CI job beyond the table.
