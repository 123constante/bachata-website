# P3 create event: field inventory (round 3, Step 1 of the brief)

Everything a person can set when creating (or straight after creating) an event, and where
each one lives today. Written BEFORE redrawing C. Paths are relative to the repo root, on
`main` at 886f935.

**Columns.** *Admin* = the admin app. Its source (`bachata-admin-11april`) was not reachable
from this session, so admin cells cite this repo's docs about it, plus the live columns of
`event_series_p5` (read-only `information_schema` query, 2026-10-30). *Website* = the live
classic organiser (`src/modules/organiser/flows/new/` create wizard and
`src/modules/organiser/events/` editor). "P3 only" = `src/modules/organiser/p3/`, which sits
behind the `organiserP3` flag (off by default, `p3/__tests__/flagOff.test.ts:17`). *Public* =
`src/modules/event-page/bento/BentoPage.tsx` and its blocks. *C r3* = the phone numbers in
`c.html` that draw it.

**GAP** = the admin app or the database has it, the Website does not. Every GAP is still drawn,
with a gold "New here" tag.

The brief names some files that do not exist: `NewEventPage.tsx`, `newEvent.ts`, `ReviewCard.tsx`
and `reviewModel.ts`. The create wizard is `flows/new/NewFlow.tsx` + `flows/new/model.ts`.
`shared/createModel.ts` keeps an old `EVENT_KINDS` list (party / weekly_class,
`createModel.ts:19-27`); NewFlow imports only `createBlock` from it (`NewFlow.tsx:6`).

## Kind of event

| # | Field | Admin | Website | Public shows? | C r3 |
|---|---|---|---|---|---|
| 1 | Format: one_off / recurring / course / festival | Yes, all four (`docs/event-truth-table.md:31,41`) | Creates `one_off` "One night" and `recurring` "Weekly night" only (`flows/new/model.ts:20-23`, `events/eventType.ts:10`) | Indirectly, as a dates ladder or a list (`BentoPage.tsx:469-480`) | C1 (nine kinds), C5-C11 |
| 2 | Course | Yes, `course_total_sessions` (`event-truth-table.md:42`) | **GAP**: cannot be created | Weeks ladder (`WeeksLadderBlock.tsx`) | C8, with "Classes" tagged |
| 3 | Festival (several days) | Yes (`event-truth-table.md:31`) | **GAP**: read-only label (`eventType.ts:16`) | Yes | C10, C31 |
| 4 | Workshop (one day, several classes) | Yes, as category `workshop` | Possible only as a one date with sessions added later | Yes | C9 |
| 5 | Category (party, class, workshop, masterclass) | Was an "Event type" select, now derived (`event-truth-table.md:17,29-34`) | No picker by design: derived from the sessions (`eventType.ts:1-6`, `src/lib/eventCategory.ts:23-29`) | Calendar tabs | Not asked. The C1 tiles only pick the format and the first session; the note on C1 says so |
| 6 | Online event (`livestream_url` column) | Column exists; editor field unknown in the docs | **GAP**: no field. `livestreamUrl` is read into the page model only | No | C11, C44 |
| 7 | Class, then party (two sessions on one night) | Yes, via sessions | Only by adding sessions after create | Yes (`ScheduleBlock.tsx`) | C1, C6, C28 |

## Basics

| # | Field | Admin | Website | Public shows? | C r3 |
|---|---|---|---|---|---|
| 8 | Which page it belongs to (2+ pages) | n/a | Yes (`whichPageModel.ts:8-11`, `NewFlow.tsx:102`) | Organiser card | C2 |
| 9 | Name, up to 120 letters | Yes | Yes (`NewFlow.tsx:160`, `Details.tsx:38`, `p3/data/details.ts:33`) | Yes (`BentoPage.tsx:450-453`) | C3-C11; C4 (missing) |
| 10 | Description, up to 4,000 letters | Yes | Edit only, not at create (`EditorSheet.tsx:15`, `Details.tsx:38`) | Yes (`BentoPage.tsx:483`) | C37 |
| 11 | City | Yes, `default_city_id` | Filled in from the venue, never asked (`NewFlow.tsx:190`, `model.ts:34`) | Yes (`CityBlock`, `BentoPage.tsx:524`) | Shown in the Where row (C5-C10); never asked |
| 12 | Venue search | Yes | Yes, public venues, 50 rows (`NewFlow.tsx:34,184,216`) | Yes (`VenueBlock`, `BentoPage.tsx:489`) | C46-C48 |
| 13 | New venue / venue not found | `admin_save_venue_v2` (`docs/ops/vercel-html-caching-2026-10-08.md:80`) | **GAP**: dead end "No venue matches" (`NewFlow.tsx:200`) | n/a | C49 |
| 14 | Organisers / co-hosts | Yes | Edit only, pages you run, at least 1 (`organisersModel.ts:13-22,41`, `SeriesOrganisers.tsx:47`) | Yes (`OrganiserCardBlock`, `BentoPage.tsx:498`) | C40 |
| 15 | Cover photo: JPEG/PNG/WebP, 10 MB in, re-encoded to about 1 MB | Yes | Yes, required to go live (`model.ts:58`, `shared/flyerModel.ts:9,18-30`) | Yes (`CoverBlock`) | C5-C11, C41, C42 (too big) |
| 16 | Gallery, up to 30 | Yes | Edit only (`eventModel.ts:77`, `Details.tsx:226`) | Yes, rotates in the cover | C41; row on C5-C11 |
| 17 | Video links, up to 10 | Yes | Edit only (`eventModel.ts:78`, `Details.tsx:227`) | Yes (`VideoBlock`, `BentoPage.tsx:543`) | C41 |

## Dates and repeat rules

Production shapes (read-only counts, `event_series_p5.recurrence_rule`, 2026-10-30): weekly
with one weekday 51; monthly `nth_weekday` (first / second / third) 6; monthly
`weekday_except_last` 1; monthly `day_of_month` 1; `custom` dates 1. End kinds: `none` 39+,
`after_count` up to 16 (and one at 72), `until_date` 3. Up to 10 dates taken off on one series.

| # | Field | Admin | Website | Public shows? | C r3 |
|---|---|---|---|---|---|
| 18 | One date | Yes | Yes: `one_off` create; "One date" = `stop_repeating` (`eventModel.ts:204`, `schedule.ts:78`) | Yes (`DateBlock`) | C5, C9; "One date" tab on every repeat sheet |
| 19 | Weekly, one weekday | Yes | Yes, the first date's weekday, no end (`model.ts:39-41`, `seriesCommands.ts:407-410`) | Dates list | C12 |
| 20 | Weekly, several weekdays | Yes | P3 only, 1-7 weekdays (`p3/model/repeat.ts:12,43`) | Dates list | C6, C12 |
| 21 | Every other week / every N weeks (1-4) | Yes | P3 only (`repeat.ts:43`) | Dates list | C13, C11 |
| 22 | Monthly, nth weekday (first-fourth, last) | Yes | P3 only (`repeat.ts:13,32`; words from `schedule.ts:54`) | Dates list | C14, C7 |
| 23 | Monthly, several nth weekdays (`multi_nth_weekday`) | Yes | P3 only (`repeat.ts:32`) | Dates list | C16 |
| 24 | Monthly, day of month (1-31) | Yes | P3 only (`repeat.ts:13,30`) | Dates list | C17, C18 (the 31st) |
| 25 | Every N months (1-4) | Yes | P3 only (`repeat.ts:27,43`) | Dates list | C15 |
| 26 | Every weekday except the last of the month (`weekday_except_last`) | Admin only (`docs/design/w3c-1-repeat.md:7,21`) | **GAP**: read-only, and `rulePattern` falls back to the word "Monthly" (`schedule.ts:58`) | Dates list | C19 |
| 27 | Chosen dates (`custom`) | Admin only (`p3/CONTRACT.md:266`, `w3c-1-repeat.md:7`) | **GAP**: read-only (`repeat.ts:121`, `schedule.ts:60`); dates can be added one by one | Dates list | C1 "Other dates", C20, C21 (empty) |
| 28 | First date | Yes | Create: next 30 days only (`model.ts:96`); edit: any date from today (`EditorSheet.tsx:185`) | Yes | "Starts" row C6-C7, C11; any future date |
| 29 | Ends: keeps going | Yes | Yes, `end.kind none` | n/a | C22 |
| 30 | Ends: on a date | Yes | Classic: "Listed until" 4/8/12/16/26 dates, 12 months at most (`dateCap.ts:21,25`); P3: up to 24 months (`repeat.ts:14`) | n/a | C23, C24 (before first date) |
| 31 | Ends: after N dates (1-500) | Yes | P3 only (`repeat.ts:14,43`) | n/a | C25, C26 (over the cap) |
| 32 | Series cap: 30 upcoming dates listed, Extend adds 8 | Server rule | `MAX_UPCOMING` 30, `EXTEND_BATCH` 8 (`dateCap.ts:17,19`) | n/a | Note on C12-C22 and C21 |
| 33 | Dates taken off / put back | Yes | Yes (`takenOff.ts:43-62`, `DatesTakenOff.tsx`); put back blocked at 30 listed (`takenOff.ts:13`) | Those dates are hidden | C27; row on the repeating forms |
| 34 | Course length (number of classes) | `course_total_sessions` | **GAP** | Weeks ladder | C8 |
| 35 | Festival days (first to last day) | Yes | **GAP** | Yes | C10, C31 |

## Sessions (an event's times live on its sessions, not on the event)

| # | Field | Admin | Website | Public shows? | C r3 |
|---|---|---|---|---|---|
| 36 | Session type: class, masterclass, party, performance | Yes | Yes (`shared/programmeModel.ts:20`) | Yes (`ScheduleBlock`) | C28 |
| 37 | Session start and end (5-720 minutes, span up to 20 hours) | Yes | Yes (`programmeModel.ts:57-61`, `programmeSeriesModel.ts:38-42`); the create wizard asks a start only (`model.ts:45,103`) | Yes | C28, C29 (none), C30 (end not after start) |
| 38 | Level per class session: beginner, improver, intermediate, advanced, open level | `default_level` mirror (`event-truth-table.md:46`) | Per session, class and masterclass only (`programmeModel.ts:23-27`) | Yes (`ScheduleBlock.tsx:49-57`) | C28; Level row on C6, C8, C9 |
| 39 | Line-up: teaching, DJing, MC, performing | Yes | Per session (`programmeModel.ts:72-76`, `ProgrammeSheet.tsx:108-130`) | Yes (PeopleStack) | C38, C39 |
| 40 | Rooms | `set_rooms`, admin only (`CONTRACT.md:476`) | **GAP** to define; P3 picks a room when the venue has 2+ (`SessionSheet.tsx:221`) | Yes (`ScheduleBlock.tsx:79`) | C31 |
| 41 | Per-date time change | Yes | Yes, `occurrence.set_time` (`seriesCommands.ts:289-293`) | Yes | Not drawn (see coverage) |

## Price and tickets

| # | Field | Admin | Website | Public shows? | C r3 |
|---|---|---|---|---|---|
| 42 | Free / at the door / cash / bank transfer (`payment_methods`) | Yes | Yes (`paymentModel.ts:8-17`); a festival takes a ticket link only (`paymentModel.ts:31-32`) | No (the section that showed it is not imported) | C32, C33 |
| 43 | Ticket link | Yes | Edit only, up to 500 letters (`Details.tsx:205`) | Yes, sticky bar (`BentoPage.tsx:836-839`) | C34; C10 festival |
| 44 | Price list (passes, up to 10) | Yes | P3 only (`p3/data/prices.ts:16-22`, `seriesCommands.ts:69-74`) | Search-engine data only (`BentoPage.tsx:632`) | C33 (price + student price), C34 |
| 45 | Sell tickets here (Stripe ticket types, places, sales window) | Not in the docs | P3 only, behind `organiserTicketing` (`p3/tickets/TypeSheet.tsx:28,152,242`) | Yes, behind `publicTicketing` | C35, C36 (no payout account) |

## Details and extras

| # | Field | Admin | Website | Public shows? | C r3 |
|---|---|---|---|---|---|
| 46 | Music styles | Yes | Edit only (`musicModel.ts:11`: Bachata, Sensual, Dominican, Salsa, Kizomba, Brazilian Zouk, Merengue, Reggaeton, Urban Kiz, Cuban) | Yes (`MusicStylesRow`) | C37 |
| 47 | Age | Unknown in the docs; read from meta (`buildEventPageModel.ts:123-124`) | **GAP** | No | C37 |
| 48 | Dress code | Same as age | **GAP** | No | C37 |
| 49 | Places (capacity) | Guest list places only (`vercel-html-caching:88`) | Stripe ticket places only (P3) | Guest list spots | C37 (event), C45 (guest list), C35 (per ticket) |
| 50 | Language it is taught in | Not found anywhere | **GAP** (new idea, not even in the database) | No | C37 |
| 51 | Group chat link | Yes | P3 only, https (`p3/data/details.ts:171`) | Yes (`GroupChatBlock`) | C43 |
| 52 | Instagram | Yes | P3 only (`p3/data/details.ts:25`) | No (`ContactsBlock` is not imported) | C43 |
| 53 | Website / Facebook / TikTok | Yes (`CONTRACT.md:379`) | **GAP** | No | C43 |
| 54 | Guest list (places, waiting list) | `admin_save_event_guest_list_config_v1` | **GAP** | Yes (`BentoPage.tsx:531`) | C45 |
| 55 | Raffle | `admin_assign_raffle_preset_v1` | **GAP** | Yes (`BentoPage.tsx:540`) | C45 |
| 56 | Promo codes | Yes (`docs/handovers/ticket-promo-codes-web.md:13`) | **GAP** | Yes (`PromoBlock`) | C45 |

## Lifecycle

| # | Field | Admin | Website | Public shows? | C r3 |
|---|---|---|---|---|---|
| 57 | Save as draft / go live | Yes | Yes; go live needs a cover and a session (`model.ts:55,69-80`) | n/a | C3 (disabled with reason), C51, C54, C55 |
| 58 | Leave mid-way / discard the draft | Hard delete is admin only (`admin_delete_series_p5_v1`) | Discard = archive (`LifecycleActions.tsx:162`) | n/a | C52, C53 |
| 59 | Copy / duplicate | `admin_duplicate_event_p5` (`CONTRACT.md:117`) | **GAP** ("Make a copy" is a label only, `p3/model/labels.ts:107`) | n/a | C59, C60 |
| 60 | Cancel one date | Yes | Yes (`flows/cancel/Confirm.tsx:105`) | Cancelled banner | C59, C61 |
| 61 | Cancel the whole event | Yes | P3 for a one date (`seriesCommands.ts:269`) | Yes | C62 |
| 62 | Pause / end the run | Yes | Yes (`flows/event/EventStep.tsx:18-28`, `EndStep.tsx:22`) | Paused banner, ended record | C59 |
| 63 | Move a date / change one date (title, venue, cover, ticket link, price, gallery) | Yes | Yes, per-date overrides (`seriesCommands.ts:117-120,276`) | Yes | Not drawn (see coverage) |

## Inventory coverage (Step 3 self-audit)

- **63 inventory rows. 60 are drawn in C r3, and 3 are not.**
- Not drawn, and why:
  - **#41 per-date time change** and **#63 move a date / change one date**. These change one date of an event that already exists. They live on the P3 event page's Dates screens (W2/W3 designs, `docs/design/w3c-1-repeat.md`), not in create. C59 shows the way into them (cancel a date).
  - **#5 category** is never asked, on purpose: the code derives it from the sessions (`eventType.ts:1-6`). C1 says what each kind seeds.
- Also not drawn, because it is not a setting: RSVP / "going" is a dancer action.
- **GAPs drawn:** course length, festival, festival days and rooms, online, new venue,
  every weekday except the last, chosen dates, age, dress code, language, places, website /
  Facebook / TikTok, guest list, raffle, promo codes, copy, and creating a course or festival at all.
  Each one needs a server command or column before build.
- **Admin column limits:** the admin source was not reachable. Admin cells come from this
  repo's docs and the live column list. For age, dress code, online and language, the admin
  editor's behaviour is unknown.
