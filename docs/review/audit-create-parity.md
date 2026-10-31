# Audit: create/edit parity before old-area retirement (read-only)

Ticket dt_8d2cb0e51473. Date 2026-10-31. Docs only; no code touched. Prod `stsdtacfauprzrdebmzg`, counts only.
"Old area" = R1 `/account/o` (`src/modules/organiser/events/`, `flows/`, `shared/createModel.ts`). "New" = P3 `/account/p3` (`src/modules/organiser/p3/`, flag `organiserP3`, `src/lib/featureFlags.ts:67`). "Admin" = `bachata-admin-11april` (not in this checkout; not read).

## Findings that change the brief's premise (read first)

1. **The P3 create flow has no "Coming soon" for Course/Festival/Online.** No such string exists under `organiser/` (grep). P3 "New event" is the *same* R1 `NewFlow` mounted in P3's frame (`p3/shell/P3Routes.tsx:79-80`, `P3_PATHS.newWhat` at `p3/shell/paths.ts`), offering exactly two kinds, `NEW_FORMATS` = weekly night + one night (`flows/new/model.ts:19-22`). If a "Coming soon" tile exists it is not in this repo's HEAD.
2. **The old area cannot create Course, Festival or Online either**: `flows/new/model.ts:19` ("Course and festival are never created in R1"); `OwnerFormat = 'one_off' | 'recurring'` (`shared/seriesCommands.ts:117`). So retiring the old area removes no create capability for those kinds; the gap is old = new = missing.
3. **"Online" is not a format in prod.** `event_series_p5.format` values are `course, festival, one_off, recurring` only; no online/virtual column on `event_series_p5`. There is nothing to lose for Online.
4. **Real regression found: the series-level multi-photo gallery.** Old area edits it (`events/EditorSheet.tsx:105` `case 'gallery'`, saved via `events/seriesExtras.ts:14` `mediaCommand(... 'default_gallery' ...)`, wired in `events/Details.tsx:134`). P3 has **no** `default_gallery` writer (`grep default_gallery src/modules/organiser/p3` = none; `p3/data/details.ts` fields are name, description, music, venue, ticket, cover, instagram, videos). P3 has only the *per-date* photos (`p3/screens/DateSheet.tsx:277-279`, `edit-photos`) and a single cover.
5. **"Make a copy" is not built in P3**: `makeCopy` label exists (`p3/model/labels.ts:107`) with zero users. Old area has no series duplicate either (grep: none), so this is old = new = absent; CONTRACT F1/A3 R3 (`docs/organiser-rebuild/p3/CONTRACT.md:~480`) plans it.

## 1. Inventory

Legend: HAS / GAP / DEFERRED (on purpose, doc cited).

| # | Capability | Old area (R1) | New (P3) | Admin | Status (P3 vs old) |
|---|---|---|---|---|---|
| 1 | Create weekly (recurring) | `flows/new/model.ts:21`, `NewFlow.tsx:107` | same flow, `P3Routes.tsx:79` | not read | HAS |
| 2 | Create one-off (party) | `flows/new/model.ts:22` | same flow | not read | HAS |
| 3 | Create course | none (`model.ts:19`) | none | admin creates (format=course exists, 16 rows) | DEFERRED (R1 decision "never created in R1"; P3 CONTRACT keeps course owner-edit only) |
| 4 | Create festival | none (`model.ts:19`) | none | admin only (`CONTRACT.md:211` festival admin-only) | DEFERRED (`CONTRACT.md:211,468`) |
| 5 | Create online | none | none | no such format in prod | N/A (nothing exists; counted DEFERRED) |
| 6 | Create series copy / "Make a copy" | none | label only, unused (`labels.ts:107`) | admin duplicate (`CONTRACT.md:379`) | DEFERRED (`CONTRACT.md` F1/A3 R3, recommend yes, not built) |
| 7 | Edit name | `events/Details.tsx` | `p3/data/details.ts:19,43`, `DetailsScreen.tsx` | yes | HAS |
| 8 | Edit description | `EditorSheet.tsx:274` | `details.ts:20` | yes | HAS |
| 9 | Edit music styles | `events/musicModel.ts`, `MusicEdit.tsx` | `details.ts:21,59` | yes | HAS |
| 10 | Edit venue | `EditorSheet.tsx:243` | `details.ts:22` | yes | HAS |
| 11 | Edit ticket link | `EditorSheet.tsx:288` | `details.ts:23` | yes | HAS |
| 12 | Cover image (single) | `events/media.ts:11`, `flows/fix/CoverFlow.tsx` | `DetailsScreen.tsx:6-7` (uploadFlyer) | yes | HAS |
| 13 | Series gallery (multi-picture) | `EditorSheet.tsx:105`, `seriesExtras.ts:14` | **none** | yes | **GAP** |
| 14 | Video links | `EditorSheet.tsx:138` | `details.ts:27,50,56` | yes | HAS |
| 15 | Instagram | old Details | `details.ts:25` | yes | HAS |
| 16 | Prices / pass list + pay methods | `events/PaymentEdit.tsx`, `paymentModel.ts` | `p3/data/prices.ts`, `PricesScreen.tsx` | yes | HAS |
| 17 | Level (`default_level`) | `eventModel.ts:39,409` (prod: null on every series per code comment 2026-10-17) | no editor | yes | GAP (no prod data; low harm) |
| 18 | Start time / date / repeat rule | `EditorSheet.tsx:182,192`, `dateCap.ts` | `RepeatSheet.tsx`, `DateSheet.tsx`, `p3/model/repeat.ts` (wider than old) | yes | HAS |
| 19 | End repeat ("until") | `EditorSheet.tsx:227` | `RepeatSheet.tsx` | yes | HAS |
| 20 | Add a date | `flows/add/` | `AllDatesScreen.tsx:60`, `EventPage.tsx:127` | yes | HAS |
| 21 | Cancel a date / event; skip a week | `flows/cancel/` | `CancelEventSheet.tsx`, `DateSheet.tsx` | yes | HAS |
| 22 | Per-date override: venue, note, ticket, cover | `flows/change/` | `DateSheet.tsx:272` | yes | HAS |
| 23 | Per-date override: name, photos, price | not in old OWNER set pre-P3 (`seriesCommands.ts:117-120` now has title/gallery/passes) | `DateSheet.tsx:274-279` | yes | HAS (P3 adds) |
| 24 | Copy another date's changes onto a date | `flows/change/Copy.tsx` | none | n/a | DEFERRED (`CONTRACT.md` #148: "stays out", composite writes not atomic) |
| 25 | Programme / line-up (sessions) | `events/ProgrammeSeries.tsx`, `programmeSeriesApi.ts` | `LineupSheet.tsx`, `SessionSheet.tsx`, `p3/model/programme.ts` | yes | HAS |
| 26 | Festival programme edit | refused (server) | read-only "ask us" (`labels.ts:210`) | admin | DEFERRED (`CONTRACT.md:468` #24) |
| 27 | Go live / pause / end | `events/LifecycleActions.tsx` | `StatusSheet.tsx` | yes | HAS |
| 28 | Co-organiser pages on an event | `events/SeriesOrganisers.tsx` | reused in P3 (`P3Routes.tsx:78`) | yes | HAS |
| 29 | Door/ticketing | n/a | `p3/door/` (flag organiserTicketing) | n/a | new in P3 |

Course/festival *edit* in P3: format-aware (course: `repeat.ts:98`; festival: `labels.ts:210,321`, `dates.ts:71-72`), edit of name/venue/etc. open to owners; festival time/day/programme locked to admin.

## 2. GAPs: who is hurt, can the old area still do it?

Prod `event_series_p5` (series count / distinct organisers):

| format | live | draft | ended | other |
|---|---|---|---|---|
| course | 6 / 5 | 1 / 1 | 8 / 5 | archived 1 |
| festival | 8 / 7 | 0 | 0 | archived 5 / 3 |
| one_off | 10 / 6 | 4 / 2 | 0 | paused 1, archived 635 |
| recurring | 45 / 24 | 8 / 3 | 13 / 11 | paused 1, archived 12 |
| online | no such format | | | |

- **Row 3/4/5 (create course/festival/online):** nobody can do this in old *or* new today (verified in code). Hurt: any organiser wanting to *start* one: 0 can today. Live items of the kinds exist (course 6/5 organisers, festival 8/7) but were admin-created. Retirement removes nothing.
- **Row 13 (series multi-photo gallery):** series with a multi-photo (>1) gallery in prod: live recurring 4, ended recurring 3, live course 1, live festival 2 (festival = admin-edited anyway), archived one_off 2 / festival 2. Live owner-editable affected: **5 live series** (4 recurring + 1 course). Counts of distinct organisers were not split per row (cross-join not run to keep counts clean). The old area can still edit it today via `EditorSheet` gallery sheet (code path above). After retirement, owners can only add per-date photos or ask admin. Gallery on the public page is still *shown*; it just can't be changed.
- **Row 17 (level):** code comment says null on every prod series; no data harmed. Old area can still set it only via model code (`eventModel.ts:409`); no UI row found in `Details.tsx` for it, so likely already unreachable. Not verified in UI.
- **Row 6 (series copy):** absent in both; planned.
- **Row 24 (copy date changes):** old area does it (`flows/change/Copy.tsx`); P3 does not; deliberately out per `CONTRACT.md` #148.

## 3. Coverage and verdicts

Rows: 29. HAS: 19 (rows 1,2,7-12,14-16,18-23,25,27,28; row 23 counted HAS; row 29 excluded below). GAP: 2 (13, 17). DEFERRED: 7 (3,4,5,6,24,26 plus row 5 N/A). New-only: 1 (29).
Exact count: 29 rows = 18 HAS + 2 GAP + 6 DEFERRED + 1 N/A (row 5 online) + 1 new-in-P3 (row 29) + row 22/23 included in HAS count (18 = rows 1,2,7,8,9,10,11,12,14,15,16,18,19,20,21,22,23,25,27,28 minus 2 = see table; recount by status column).

(Recount from the table: HAS = 1,2,7,8,9,10,11,12,14,15,16,18,19,20,21,22,23,25,27,28 = 20; GAP = 13,17 = 2; DEFERRED = 3,4,5,6,24,26 = 6; new-in-P3 = 29 = 1. Total 29. Use these figures.)

| Capability | RETIRE-SAFE |
|---|---|
| Create weekly / one-off | YES |
| Create course / festival / online | YES (old area cannot either) |
| Series copy | YES (absent in old) |
| Edit name, about, music, venue, ticket, cover, video, Instagram, prices | YES |
| Dates: add, cancel, skip, repeat, until, per-date overrides, programme, lifecycle, co-organisers | YES |
| Series multi-picture gallery | **NO-BLOCKS-RETIREMENT** (5 live owner-editable series; P3 has no writer) |
| Copy another date's changes | YES, as a conscious loss (CONTRACT #148) |
| Level | YES (no data, no UI) |

## Verified / Not verified
Verified: code paths and greps at HEAD of `main` (58bc84c); prod counts above via read-only SELECT. Not verified: admin repo; live behaviour in a browser; any "Coming soon" tile (not in this repo); per-row distinct organiser counts for the gallery gap; whether a tile exists in a deployed build differing from main.
