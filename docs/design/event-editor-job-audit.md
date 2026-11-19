# Organiser event editor: job audit (origin/main ee0df6ccd)

Scope: R1 organiser editor under `src/modules/organiser/events/`, `flows/`, `dates/`. Taps counted from the event card (row in My events) at 390x844. Code-read only, not walked. Design picks: DESIGN-REGISTRY row "Organiser Events + Team layouts" (canvas Round 4 screens 6-10, 13-15; not built). The P3/R4 build lives in `src/modules/organiser/p3/` behind `VITE_ENABLE_ORGANISER_P3` (shell/OrganiserRoutes.tsx:97); it is NOT what this audit maps.

Note on the old note: `EventEditorPage.tsx` does not exist. The editor is a set of small screens, not one page.

## 1. Map (card -> field)

Card = EventList row (EventList.tsx:26). Tap 1 opens the event page (OneEvent). Tap counts include opening the field editor, not Save.

| Place | Route / file | Taps | Weekly | One-off | Workshop (one-off + class sessions) |
|---|---|---|---|---|---|
| Event page: month dots, coming dates, cancelled, past, taken-off, pause/end/day/stop/weekly rows | OneEvent.tsx:235-248 | 1 | all | no repeat rows | same as one-off |
| Details list (name, venue, time, music, tickets, about, pay, programme, cast, organisers, flyer, gallery, videos) | Details.tsx:203-230 | 2 (title row, OneEvent.tsx:235) | yes | yes | yes |
| Name / time / music / tickets link / about / pay | Details.tsx:44, MusicEdit, PaymentEdit | 3 | yes | yes | yes |
| Venue | EditorSheet sheet, Details.tsx:193 | 3 | yes | yes | yes |
| Flyer | /cover/:id via Details.tsx:222 | 3 | yes | yes | yes |
| Gallery / videos | EditorSheet, Details.tsx:228-229 | 3 | yes | yes | yes |
| Programme (series sessions, ProgrammeSeries) | Details.tsx:210 | 3, sheet = 4 | yes | yes | yes (festival read-only) |
| Organisers of event | Details.tsx:215 | 3 | yes | yes | yes |
| Date page: sessions, line-up, venue, time, take off, cancel | dates/index.tsx, via "Sessions" link OneEvent.tsx:117 | 2 | yes | yes | yes |
| Change one date: time / venue / note / ticket / picture / copy | WhatChanges.tsx:34-40, tap date row OneEvent.tsx:105 | 3, field = 4 | yes | yes | yes |
| Add a date | OneEvent.tsx:131 or Actions row | 2-3 + 2 more steps | yes | yes | yes |
| Cancel a date | WhatChanges.tsx:52, then confirm | 4 + confirm | yes | yes | yes |
| End / Pause | OneEvent.tsx:165-186 | 2 + confirm | yes | yes | yes |

Type decides almost nothing. The only type switches are the repeat rows (Actions, eventType.ts / eventSteps.ts:50-63) and no Type row (eventType.ts:4-8, decision d39). A workshop has no type: it is a one-off with sessions. A course/festival cannot be created in R1 (eventType.ts:14).

## 2. Jobs

| Job | Taps today | Lives in | Feedback after save | Findable? |
|---|---|---|---|---|
| Date | 3-4 (card, date row, "Change the time", Save) | Event page dates then WhatChanges | Done screen "Saved" (useEventSend.ts:20) | Partly: "Change the time" is hidden behind a date row; Details "Time" is a separate series-wide time |
| Time (series) | 3 + Save | Details "Time" box (Details.tsx:65) | Done screen | Two places for time; no hint which is which |
| Venue | 3, then sheet closes = save | Details Venue sheet | Done screen, no Save button (Details.tsx:129-151) | Silent save on close |
| Tickets and prices | Link only: 3 + Save. Prices: none in R1 | Details "Tickets" (URL text) and "How to pay" chips | Done screen | NO. R1 has no ticket price or ticket type editor; that exists only in P3 (`p3/r4/R4Tickets.tsx`, `tickets/priceSteps.ts` used only by P3) |
| Programme / classes | 3-4 + Save | Details Programme row, ProgrammeSeries; also date page Sessions | Done screen | Two homes: series programme and per-date Sessions (OneEvent.tsx:117, Details.tsx:210); cast row is read-only, not a link (Details.tsx:211) |
| Poster | 3 (own screen) | cover route | Done screen | Row says "Flyer"; Gallery and Videos sit below |
| Text / links | 3 + Save per field | Details About, Tickets, Instagram absent from list | Done screen | About shows first 40 chars only (Details.tsx:79) |
| Cancel | 4 + confirm | Event page -> date -> "Cancel this date" (WhatChanges.tsx:52); also Home Cancel flow | Done screen with Put it back | No cancel row on event page itself; whole-event cancel absent (End is the closest) |
| Guest list | none in R1 | Only P3 (`p3/guestlist/`, `r4/R4GuestList.tsx`) | n/a | Not present in R1 |
| Add teammate | 2 (Team tab, Add) not verified in shell | team/index.tsx:202 | Done screen | Not reachable from the event card; event Organisers row is a different thing (Details.tsx:215) |

## 3. Save model

Mixed. Four models in one editor.

| Area | Model | Unsaved state lost where | What says "saved" |
|---|---|---|---|
| Name, time, music, tickets, about, pay | One Save per field screen, disabled until changed ("Nothing changed yet", Details.tsx:68) | Back or tab away drops typing, no guard (no `useUnsavedChangesGuard` in events/) | Done screen |
| Venue, gallery, videos | Sheet: save fires on close (Details.tsx:129-151) | Failed save shows error under the list (Details.tsx:231), sheet already gone | Done screen |
| Programme | Local draft, one Save at the bottom (ProgrammeSeries.tsx:174) | Leaving the page loses draft; "Save to keep it" only as an aria announcement (ProgrammeSeries.tsx:160) | Done screen |
| Date page | Sticky PreviewBar Save (dates/index.tsx:271), leave guard (dates/index.tsx:72), Cancel/Take off disabled while dirty (:248-252) | Guarded, with prompt | PreviewBar state, then save |

Every save ends on the shared Done screen (goDone), which removes the organiser from the editor. No inline "Saved" toast, no "Saved at" line, no per-field status on the Details list.

## 4. Gaps against the owner's problems

| Problem | Gap | Evidence |
|---|---|---|
| Cannot find things | Time lives in two places; programme in two places; Cancel is 4 taps deep; ticket prices not in R1; Guest list not in R1; no search | Details.tsx:207 vs WhatChanges.tsx:34; Details.tsx:210 vs OneEvent.tsx:117; WhatChanges.tsx:52; grep priceSteps only in p3 |
| Too much on screen | Details is one 13-row list; event page stacks 8 blocks (month dots, coming, cancelled, past, taken-off, actions, lifecycle, closed lines) | Details.tsx:205-229; OneEvent.tsx:241-248 |
| Unclear saved | Four save models; Done screen is the only cue; venue/gallery saves are silent; field drafts lost on back | Details.tsx:129-151; useEventSend.ts:20; no guard in events/ |
| Missing things | No ticket types/prices, no guest list, no readiness dots, no quick actions on the card, no buyer-warning, no type-led sections; cast is read-only | EventList.tsx:26-31 (card is name + chip + chevron only); Details.tsx:211; eventType.ts:4-8 |
| Create vs edit differ | Create is a 6-step wizard (NewFlow.tsx:263-357), edit is the Details list: two designs | flows/new/NewFlow.tsx:377-380 vs Details.tsx |
| Buyers warning | Nothing in R1 reads buyers before editing/cancelling | no ticket/buyer read in events/ or flows/cancel |

## 5. Proposed pass mark: top jobs in 2 taps or fewer

Pass = job reachable in 2 taps from the card (card tap counts as 1; or a quick action on the card is 1).

| Job | Today | Pass? |
|---|---|---|
| Date/time of next date | 3-4 | FAIL |
| Venue | 3 | FAIL |
| Tickets link | 3 | FAIL |
| Ticket prices | not in R1 | FAIL |
| Programme / classes | 3-4 (or 2 via Sessions link) | FAIL (2 via Sessions, but per-date only) |
| Poster | 3 | FAIL |
| Text / links | 3 | FAIL |
| Cancel | 4 + confirm | FAIL |
| Guest list | none | FAIL |
| Add teammate | 2 (Team tab, Add) | PASS (unverified) |
| Pause / End | 2 + confirm | PASS |

Only 2 of 11 pass. A card with quick actions (Edit, Cancel, Guest list) and readiness dots would make the first tap land on the job.

## 6. Open product questions

1. Is Time one thing (the usual time of the event) with "this date only" as an option inside it, or two rows as today?
2. Where do ticket prices and ticket types live for edit: inside the event editor, or in the Tickets area only?
3. When buyers exist, should the warning cover every edit (date, time, venue) or only Cancel and date/time/venue changes?
4. Is a workshop its own type with its own sections (classes first), or still a one-off whose sessions say what it is (d39)?
5. Should "saved" be an inline cue that keeps you on the screen (toast plus "Saved" line), replacing the Done screen?
