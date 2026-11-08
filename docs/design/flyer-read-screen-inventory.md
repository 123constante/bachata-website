# Flyer read screen: inventory

Brief: `docs/briefs/flyer-read-screen.md` (branch `brief/flyer-read-screen`). Written BEFORE the build.
Every field, state and option the new "Start from a flyer" path meets, with where it lives and how
this slice covers it. `C` = covered by this slice, `N` = not in this slice (says why).

**Coverage: 42 of 50 items covered (84%).** The 8 not covered are out of scope by the brief.

## A. The reader's answer (`src/modules/organiser/p3/new/flyerReadShape.ts`)

The admin repo (`bachata-admin-11april`, the event-smart-import review screen and the `event-flyer-read`
function) is NOT attached to this session, so its review screen is listed through the typed copy of its
response, which is the contract this repo builds against.

| # | Item | Where | Covered |
|---|------|-------|---------|
| A1 | `kind` (one_off, weekly, monthly, course, festival, multi_event, not_enough) | flyerReadShape.ts:7 | C: sets the draft kind; course and festival (not buildable yet, model.ts:47,49) fall back to Weekly / Other dates / One date with a note |
| A2 | `event_count_on_flyer` | flyerReadShape.ts:27 | C: "several events" note (flyerToDraft.ts:76) |
| A3 | `title` | flyerReadShape.ts:28 | C: Name |
| A4 | `organiser_text` | flyerReadShape.ts:29 | N: the page is chosen by the page step, never from flyer text |
| A5 | `dates[].date_start` / `date_end` | flyerReadShape.ts:10-11 | C: first date, extra dates for a range |
| A6 | `dates[].year_printed` | flyerReadShape.ts:12 | N: flyerToDraft does not read it (slice 2) |
| A7 | `dates[].weekday_printed` | flyerReadShape.ts:13 | C: next date on that weekday (weekly / monthly) |
| A8 | `dates[].recurrence_text` | flyerReadShape.ts:14 | N: never an auto repeat rule (brief) |
| A9 | `start_time` / `end_time` | flyerReadShape.ts:32-33 | N: times live on sessions; flyerToDraft does not map them (slice 2) |
| A10 | `ends_after_midnight` | flyerReadShape.ts:34 | C: implied by session end earlier than start (flyerToDraft.ts:163) |
| A11 | `venue_name` / `venue_address` | flyerReadShape.ts:35-36 | C: matched venue, or "Flyer says: ..." beside the picker |
| A12 | `sessions[]` (type, start, end, label) | flyerReadShape.ts:37 | C: tick list |
| A13 | `price` (amount_pence, currency) | flyerReadShape.ts:38 | C: one price row, marked "check this" |
| A14 | `ticket_url_visible` | flyerReadShape.ts:39 | C: ticket link (pay method "ticket link" switched on so the field shows) |
| A15 | `doubtful_fields` | flyerReadShape.ts:40 | C: "check this" marks |
| A16 | `notes` (free text) | flyerReadShape.ts:41 | N: untrusted free text is not shown; flyerToDraft's own notes are |

## B. The function's refusals (brief, What to build 2)

| # | Item | Covered |
|---|------|---------|
| B1 | `daily_limit` + `resets_at` | C: "You've used today's 5 flyer reads, back <weekday time>" |
| B2 | `attempts_limit` | C: same card, no time |
| B3 | `switched_off` | C: "Flyer reading is paused for now" |
| B4 | `not_organiser` | C: plain card, blank form |
| B5 | `unauthorised` | C: plain card, sign in again, blank form |
| B6 | `bad_image` | C: "Couldn't read that one" |
| B7 | `read_failed` | C: "Couldn't read that one" |
| B8 | offline (no network) | C |
| B9 | any other error / off-shape answer | C: "Couldn't read that one" |

## C. The Website New event flow (P3 `CreateFlow`)

| # | Item | Where | Covered |
|---|------|-------|---------|
| C1 | Kind step: nine tiles, three deferred | CreateFlow.tsx:36-62, model.ts:43-53 | C: unchanged; one extra "Start from a flyer" row when the three flags are on |
| C2 | Kind step note | CreateFlow.tsx:59 | C: unchanged |
| C3 | Page step (2+ pages) | CreateFlow.tsx:66-83 | C: the flyer path goes through `afterKind`, so it is asked as today |
| C4 | Draft storage `DRAFT_STORE_KEY` | model.ts:430, CreateFlow.tsx:146-149 | C: the flyer draft is written there |
| C5 | Boot draft / landed draft | CreateFlow.tsx:100-107 | C: unchanged |
| C6 | Name field + problem | CreateFlow.tsx:235-240 | C: "check this" mark |
| C7 | Where row + VenueSheet | CreateFlow.tsx:243, sheets.tsx:19 | C: mark + "Flyer says: ..." |
| C8 | Date (one date / repeat start) | CreateFlow.tsx:264-269 | C: mark |
| C9 | Dates list (other dates) | CreateFlow.tsx:245-262 | C: mark for extra dates |
| C10 | Repeats row + RepeatSheetNew | CreateFlow.tsx:271-273, sheets.tsx:69 | C: unchanged; the repeat note points at it |
| C11 | Sessions row + SessionsSheet | CreateFlow.tsx:275, sheets.tsx:85 | C: mark + tick list |
| C12 | Price row + PriceSheet (pay, prices, ticket link) | CreateFlow.tsx:277, sheets.tsx:133-160 | C: mark for price and ticket link |
| C13 | Cover photo picker | CreateFlow.tsx:281-290 | C: the flyer is the picked cover, replaceable as today |
| C14 | Save draft / Go live + reasons | CreateFlow.tsx:293-298 | C: unchanged; same save plan |
| C15 | Failed / partial / details screens | CreateFlow.tsx:189-233 | C: unchanged |
| C16 | Cancel + leave sheet | CreateFlow.tsx:167-173, 304-313 | C: the flyer is forgotten on leave |
| C17 | Cover upload on save (`uploadEventPicture` -> `uploadFlyer`) | useCreateSave.ts:154-168, events/media.ts:9-13 | C: the flyer goes through it only on save |

## D. The public event page (what a saved flyer event shows)

| # | Item | Where | Covered |
|---|------|-------|---------|
| D1 | Cover image | bento/BentoPage.tsx:428 | C: the flyer becomes the cover |
| D2 | Title | buildEventPageModel.ts (identity.title) | C: from Name |
| D3 | Venue block | bento/BentoPage.tsx:33,345 | C: from the matched venue |
| D4 | Schedule block | bento/BentoPage.tsx:34 | C: from ticked sessions |
| D5 | Tickets / price | bento/BentoPage.tsx:107 | C: price row and ticket link |
| D6 | Description block | bento/BentoPage.tsx:24 | N: not in this slice (brief) |
| D7 | Teachers / DJs | bento | N: not in this slice (brief) |
| D8 | Category | | N: never added (brief) |

## E. Screen states of `FlyerStart` (brief, What to build 3)

choose, reading (with cancel), read ok, failed / not a flyer, daily limit, switched off, offline,
not enough, plus the file problem (`FLYER_PROBLEM_COPY`). All covered: see
`docs/design/flyer-read-screen.md`. (Counted inside B and C above, not again.)
