# Organiser EVENTS tab: 2 options (admin #1535 follow-up)

Brief: `docs/briefs/profile-dash-organiser-events-opts.md` (branch `brief/profile-dash-organiser-events-opts`).
Docs/design only. No `src/` change, no DB write. The owner picks 1 of 2. An independent critique runs first.

> **Status (2026-11-12): the owner picked Option A.** Fix round 1 (brief `docs/briefs/profile-dash-organiser-events-fix.md`,
> branch `brief/profile-dash-organiser-events-opts`) is applied to A. **Option B: not picked.** `organiser-events-option-b.html`
> and its `shots/organiser-events-option-b-*.png` stay for the record, frozen at round 1; they are no longer rebuilt from A,
> so B does not show any of the fixes below. A is the single design from here on.

- **Base:** `organiser-option-a.html` (the owner's pick for Home), with tokens and fonts from `prototype.html.md`.
  Kept: light theme, `--bg #f3f1ee`, `--fg #1d1f24`, `--c-org #1f5c7a`, Bricolage Grotesque + DM Sans, the
  organiser strip with **Switch**, and the tab bar **Home / Events / Tickets / Team**. Stats is gone (owner, 2026-11-12).
- **File:** `organiser-events-option-a.html`, self-contained. The shape and seat switches sit above the 390x844 frame.
  Deep link: `#<shape>`; add `&shot` for a bare frame. Shapes: `empty, three, huge, series, hugeflat, allcx, mixed, needs,
  draft, told, deldraft, cxnight, pastnight, recurring, cancelrec, bulk, bulkcancel, cancel, aftercancel, contributor,
  contribneeds, loading, error`. Each shape starts from fresh example data, so a prototype cancel or delete in one shape
  never leaks into another.
- **Screenshots:** `shots/organiser-events-option-a-<shape>.png` (390x844, DPR 2), one per shape.
  **Checks:** `node docs/design/profile-dash/tools/organiser-events-shots.mjs` writes `organiser-events-checks.json`
  (Option A only now). Result: **23/23 states pass**. Every visible tap target is 44x44 CSS px or larger, every text node
  has contrast of 4.5:1 or more (lowest is 5.15), nothing scrolls sideways at 390px, no text is clipped, every frame drew
  (more than 8 text nodes), and the pinned "needs you" strip is **48px** tall (new check: it fails above 48).

## Fix round 1 (independent critique), all 8 done

| # | Critique | What A does now | Why (plain English) | Shot |
|---|---|---|---|---|
| 1 | Pinned "Needs you" card took too much room | ONE pinned line, "2 things need you &middot; See", 44px button in a 48px strip. Tap opens the full list in a sheet; each item keeps its one fixing button | The list of nights is the job of this tab. A card that grew with every problem pushed the first night below the fold | `mixed`, `needs` |
| 2 | 100+ nights: 4 weekly series x 52 dates is a wall | **Group repeating events** switch, on by default from 30 upcoming nights (off below). Grouped, the list goes by month and each series is one row per month: "Friday Social, every Friday &middot; Nov: 3 of 52 &middot; 415 going Fri 13", with **Dates** to open that month's nights. Search or a status filter shows every night again, and the switch says so | 215 upcoming nights became 15 rows that reach February, and an organiser with 3 nights never sees the switch | `huge`, `series`, `hugeflat` |
| 3 | Bulk cancel silently dropped drafts / cancelled / past | The bar's Cancel reads "Cancel 2" and says "Cancel skips 3 nights that are not live. You see which before anything happens"; with nothing live it is disabled: "Cancel only works on live nights. None of these is live." The confirmation lists **Going to be cancelled (2)** with who is going, **Skipped, nothing changes (3)** with the reason on each (Already happened / Already cancelled / A draft is not on the calendar, delete it instead), the total told, and **If some fail**: nights are cancelled one at a time, any that fail stay live and are listed so you can retry just those | Nothing happens to a night the organiser did not see named on the screen | `bulkcancel`, `bulk` |
| 4 | Cancel had no scope for repeating nights | Cancelling a repeating night asks **Which dates?** with radio marks: This night only (5 going) / This night and every one after it (11 dates, Fri 20 Nov to Fri 5 Feb, 7 going) / The whole series (12 dates, 19 going, past nights untouched). Already-cancelled dates are not counted. In Select mode, chips **All of Friday Social (12)** select a whole series | One night off and "we are stopping the Friday" are different decisions with different numbers of people told | `cancelrec`, `bulk` |
| 5 | Drafts could not be deleted | Draft night sheet: **Delete draft** opens a confirm sheet: the draft goes away, it was never on the calendar so nobody is told, cannot be undone, **Keep the draft** | A draft nobody wants should not sit in "needs you" forever | `draft`, `deldraft` |
| 6 | Contradictory cancelled story | ONE story (`CX_STORY`): a cancelled night **stays on the calendar marked Cancelled, so nobody turns up**. Cancel sheet, cancelled-night sheet, after-cancel banner and the all-cancelled Needs-you item use it; the row shows Cancelled + "12 people told" (the old "not on the calendar" line is gone) | Two screens saying opposite things about what dancers see is how an organiser gets angry messages | `cancel`, `cxnight`, `aftercancel`, `allcx` |
| 7 | Fixed draft copy; no Tell us sent state; contributor saw "Needs you" + a disabled Finish | Draft copy names what is missing from the data ("It needs **a place** before it can go live"; two drafts: "Summer Boat Party needs a place. Halloween Social needs a place and a photo."), and **Put it live** is disabled with "Add a place first". **Tell us** turns into "Sent &check;" with "Thanks, noted. We will tell you when it is ready." A contributor's pinned line reads "2 things Maria needs to finish", and each item says "Maria needs to finish this" (view only, no disabled button) | Say exactly what to do; show that a tap did something; do not show someone a button they can never press | `draft`, `told`, `contributor`, `contribneeds` |
| 8 | Missing shots, scope sheet had no visible radio marks | New shots: bulk-cancel confirmation, cancelled-night sheet, past-night sheet, the screen after a cancel (green "Cancelled: Friday Social, Fri 13 Nov. 12 people have been told..." banner, row struck through). Both scope sheets (edit and cancel) draw radio circles (`role=radio`, filled dot when picked) | | `bulkcancel`, `cxnight`, `pastnight`, `aftercancel`, `recurring`, `cancelrec` |

## Round 1 record (before the pick)

## The two layout ideas

| | **A: one list by date + sticky "Needs you"** | **B: status tabs + timeline** |
|---|---|---|
| First thing on screen | "Needs you" card, pinned to the top while you scroll (first item shown, "See N more") | Status tabs with counts: Needs you, Upcoming, Drafts, Cancelled, Past |
| The list | Every night of every event in ONE list, grouped This week / Next week / then by month. Status is a tag on each row (Live / Draft / Cancelled / Past) | One status at a time, on a month timeline. A repeating event is ONE block per month ("Friday Social, every Friday, 3 dates in November") that opens to show its dates |
| Past nights | Folded at the bottom: "Show past nights (93)" | The Past tab |
| Search | Search box + status filter chips with counts, shown once there are 8+ nights | Search box under the tabs (8+ nights). The tabs are the filter |
| 100+ nights | First 15, then "Show 30 more" ("Showing 15 of 209") | First 15 nights, folded into series blocks, so 4 weekly series read as 4 blocks per month |
| Best when | Most organisers: a handful of nights, and they think in "what is on this week" | The few big organisers with several weekly series |

### What both options share (same code)

| Need (owner, 2026-11-12) | How it shows | Shape |
|---|---|---|
| List by date with status | Date block (Fri / 13), name, a sub line (time, "every Friday, 1 of 13", "12 going" or "12 people told"), and a status tag. A cancelled name is struck through | all |
| Create | **New event** in the header opens the existing create flow. Empty state: **New event** + **Start from a photo of your flyer** (`p3/new/FlyerStart.tsx`) | `empty` |
| Edit | Night sheet: **Edit**. On a repeating event it opens the scope sheet first | `mixed-night`, `recurring` |
| Duplicate | Night sheet: **Duplicate** ("copies everything into a new draft, you pick the date"). Bulk bar: **Duplicate** | `mixed-night`, `bulk` |
| Cancel with confirmation | Sheet: "Cancel Friday Social, Fri 13 Nov?" A **What happens** box says the 12 people going get a message straight away, the night stays on the calendar marked Cancelled so nobody turns up, and it cannot be undone here. A reason is required (dancers see it), so the red button stays disabled with "Pick a reason first". **Keep the night** is the other way out | `cancel` |
| Needs you | `needsOf`: drafts ("Only your team sees a draft..." + Finish), every upcoming night cancelled (+ New event), a live night with no photo (+ Add photo), a repeating event with 2 or fewer dates left (+ Add dates). Each item has one button that exists | `mixed`, `allcx`, `three` |
| Bulk actions | **Select** shows checkboxes, and a bar above the tabs reads "3 nights selected, 17 going across them". **Duplicate**, **Put live** (disabled: "Put live only works on drafts. None of these is a draft."), **Cancel** (opens the same confirmation, listing every night and the total going), **Done** | `bulk` |
| Recurring | Row sub line "every Friday, 3 of 13". "Starts 9pm this week" marks a one-night change. Edit asks **This night only** or **This night and every one after it** ("11 dates, from Fri 20 Nov. 1 date you changed one by one keeps its own change."). **Continue to edit** is disabled until a choice is made. "Cancelled and past dates are never touched." | `recurring` |
| Search | Filters by name as you type. No match: "Nothing matches 'x'" + **Clear search and filters** | `huge` |
| Guest list and Raffle | Inside each night (the night sheet, "On the night"): two rows that read "Coming soon. It will switch on per night, here." Each has a **Tell us** button that only records interest, and the sheet says so. No fake switch | `mixed-night` |
| Tickets and money | Night sheet: one link row to the Tickets tab. No prices or payouts here | `mixed-night` |
| Contributor seat | A banner says "You are a contributor, so you can see every event but not change them. Ask Maria (owner) or a manager." New event, the Needs you buttons, Edit, Duplicate and Cancel are drawn disabled, and that banner (`aria-describedby`) gives the reason. Select is not drawn | `contributor` |
| Past / cancelled night | Edit disabled: "This night has passed, so it cannot be changed. Duplicate it to run it again." / "A cancelled night cannot be changed. Duplicate it to put it on again." A draft has no Cancel: "A draft is not on the calendar yet, so there is nothing to cancel." | `mixed-night` |
| Loading | Skeleton. New event is disabled, and a line says New event, search and filters wake up once events load | `loading` |
| Error | "We could not load your events. Nothing has changed: your live nights are still on the calendar." + **Try again** | `error` |

## What each option replaces (inventory, origin/main at branch point)

| Today | Cited at | A | B |
|---|---|---|---|
| P3 Events screen: loading / error / no page / empty "No events here yet" + Add event | src/modules/organiser/p3/screens/EventsScreen.tsx:26-52 | shared loading, error and empty states (empty adds the flyer start) | same |
| Events grouped On / Hidden / Past (`groupsOf`) | src/modules/organiser/p3/screens/EventsScreen.tsx:53-73; p3/data/home.ts:245-254 | one list by date (This week, Next week, months); Past folded at the bottom | status tabs; Past is a tab |
| Status mapping (`statusOf`: live / draft / hidden / finished / warn) | src/modules/organiser/p3/model/status.ts:25-41 | the 4 tags Live / Draft / Cancelled / Past. **Hidden (paused) is not drawn: see open question 1** | same |
| Needs you items: photo / dates / draft (`needsOf`) | src/modules/organiser/p3/data/home.ts:214-243 | sticky strip (same 3 rules + "all cancelled") | Needs you tab |
| Old events list: one row per SERIES, chip, collapsed Past | src/modules/organiser/events/EventList.tsx:22-60 | replaced: one row per NIGHT | replaced: series block per month |
| All dates of one event | src/modules/organiser/p3/screens/AllDatesScreen.tsx:15-92 | folded into the one list (dates of every event together) | series block "Show N more dates" |
| Cancel a one-off (`canCancelOneOff`, `CANCEL_WHY`) | src/modules/organiser/p3/model/cancel.ts:19-45; p3/screens/CancelEventSheet.tsx:22-81 | shared cancel sheet (reason chips kept: `ReasonPick`) | same |
| Cancel one date of a series | src/modules/organiser/dates/DateSheet.tsx:401-433 | same cancel sheet, per night | same |
| Bulk cancel of dates within one series | src/modules/organiser/shared/seriesCommands.ts:302-305; flows/change/Pick.tsx:111-116 | bulk bar Cancel (across events: careful lane) | same |
| Scope ask: one date vs all (`needsScopeAsk`, `ONE_DATE_WHY`) | src/modules/organiser/p3/model/scopeAsk.ts:19-86; p3/screens/ScopeSheet.tsx:24-55 | scope sheet: "This night only" / "This night and every one after it" | same |
| Repeat rule editor | src/modules/organiser/p3/screens/RepeatSheet.tsx:45-140 | unchanged, reached from Edit | same |
| Status moves (hide, end, go live) | src/modules/organiser/p3/screens/StatusSheet.tsx:36-58; events/LifecycleActions.tsx:102 | night sheet "Put it live" (draft); the rest stay in the editor | same |
| Old editor (OneEvent, EditorSheet, Details) | src/modules/organiser/events/OneEvent.tsx; events/EditorSheet.tsx; events/Details.tsx | not changed: Edit opens the existing editor | same |
| Date editor page | src/modules/organiser/dates/index.tsx:50-346 | not changed: reached from Edit, "this night only" | same |
| Create flow + flyer start | src/modules/organiser/p3/new/CreateFlow.tsx:29-39; p3/new/FlyerStart.tsx | New event, Start from a photo of your flyer | same |
| Profile wizard | src/modules/organiser/wizard/ProfileWizard.tsx:70-260 | not touched (profile, not events) | same |
| Duplicate | none exists (only admin-side commands: p3/data/history.ts:10-13) | new: night sheet + bulk bar | same |
| Search | none exists on Events | new: search + filter chips | new: search + tabs |
| Guest list / raffle per night | series columns only (`has_guestlist`, `raffle_enabled`); no organiser UI | "Coming soon" rows + Tell us | same |

## Real-data shapes (prod `stsdtacfauprzrdebmzg`, read-only SELECT counts, 2026-11-12)

| Fact | Count | Drives |
|---|---|---|
| Event series (non-template) by status | live 72, draft 13, paused 3, ended 24, archived 654 | tags; "paused" = open question 1 |
| By format | one_off 653, recurring 81, course 18, festival 14 | recurring sub line, series blocks |
| Organisers with any series / with none | 49 / 2 | `empty` is real but rare; `three` is common |
| Max upcoming non-cancelled dates on one organiser | **222**; **7** organisers have more than 100 (the API cap); 8 have 1 to 5 | `huge`: search, filters, "Show 30 more"; needs server paging |
| Max upcoming dates on one series | 56 | series block counts |
| Max past dates on one organiser | 93 | "Show past nights (93)" |
| Recurring series with upcoming dates | 49 | `recurring` is the common shape for active organisers |
| Organisers with a draft | 3 | Needs you "still a draft" |
| Series with a cancelled upcoming date | 4 (all 4 have no other upcoming date) | `allcx` |
| Organisers with draft AND live AND finished series | 0 | `mixed` is a stress shape, not a common one |
| Series with more than one organiser | 7 | edits by a co-host: careful lane |
| Active team rows by role | Leader 59, Member 4 | prod roles are Leader / Member, not Owner / Manager / Contributor: careful lane |
| Series with guest list on / raffle on | 6 / 54 (series level only) | per-night switch needs schema |

## Careful lane (needs a DB / RPC check in the admin repo before any build slice)

1. **Bulk across events.** `occurrence.bulk_cancel` takes the occurrence ids of ONE series
   (shared/seriesCommands.ts:302). A selection that spans events needs either one command per series (partial
   failure, so the confirmation must report per night) or a new RPC. The same applies to bulk duplicate and bulk put live,
   for which no command exists.
2. **Who is told on cancel.** The sheet says the people going get a message straight away. Check what the cancel
   commands actually send (going rows, guest list, ticket holders: labels.ts:377 `PeopleCounts`) before that
   sentence ships. If ticket holders are affected, the copy must link to Tickets for refunds.
3. **"This night and every one after it".** Today's scope ask is one date vs all (scopeAsk.ts:69-86). "From
   this date on" may need a split-series or ranged override. Also check that one-by-one overrides survive.
4. **Duplicate.** No organiser command. Needs a series copy into a draft (which fields are copied: cover,
   tickets, organiser_ids, co-hosts).
5. **Cancelled nights in the feed.** The organiser nights feed drops cancelled server-side (organiser.md GAP).
   Both options need cancelled occurrences in the read.
6. **Search over 100+.** 7 organisers exceed the 100-row cap, so search and filter counts must be server-side.
7. **Seats.** Prod team roles are Leader / Member. A view-only "contributor" seat and its RPC refusals need
   defining.
8. **Guest list / raffle per night.** The flags are series columns. A per-night switch needs an occurrence-level
   column or override.

## Open questions for the owner

1. **Hidden (paused) events** (3 in prod). The brief lists draft / live / cancelled / past. Both options leave
   hidden out. Should it be a fifth tag, or folded into Draft ("not on the calendar")?
2. Should **Put live** be in the bulk bar at all? Only 3 organisers have a draft today.

## Recommendation: **Option A**

Most organisers think "what is on this week", and A answers that the moment the tab opens. Every night of every event sits in
one list, in date order, with its status on the row, so nothing is hidden behind a tab. Prod data fits it:
only 1 of 49 organisers has 20 or more series, and 8 have only 1 to 5 upcoming dates. For them B's tabs would
split a short list into near-empty piles (`three` in B shows "Drafts 0, Cancelled 0, Past 0"). A's pinned
"Needs you" is always in sight. In B it is a tab that people have to choose to open. Cancelled nights stay
in A's list, struck through, next to the live ones, which is what an organiser checks before a weekend.

B is better for the 7 big organisers (100+ dates): its series blocks turn 4 weekly events into 4 blocks per
month. If the owner wants that, the best path is **A plus B's series block, used only above about 30 upcoming
nights** (alternative 1).

**Alternatives considered and not drawn:**
1. A + B hybrid: A's date list, with repeating events folded into blocks only for big organisers.
2. A month calendar grid: tap targets under 44px at 390px with 4 weekly series, and the public calendar
   already owns that pattern.
3. Series-first list (one row per event, its dates inside): this is today's `EventList`. It hides per-night
   status, and the owner asked for a list by date.
4. Swipe-to-cancel / swipe-to-duplicate: hidden gestures, no visible control, and too easy to trigger by accident
   for a destructive action.

## Handover

- **Round 1 (PR #1580, merged):** both options, 24 screenshots, checks 24/24, prod shape survey, inventory, careful lane, recommendation A.
- **Fix round 1 (this branch, `claude/profile-dash-organiser-events-opts`):** owner picked A; all 8 critique fixes in A, B marked not
  picked and frozen, 23 A states drawn and shot, checks 23/23 (new pinned-height check), A shots renamed per shape (the old
  `-mixed-night` shot is now `-draft`, opened from the shape instead of by a tap).
- **Left / next:** the owner looks at the fix-round shots. Then the careful-lane checks in the admin repo, which round 1 left open and
  this round makes sharper: (1) bulk cancel across series now promises per-night partial-failure reporting; (3) cancel now offers
  "this and every one after it" and "the whole series", which need ranged / series cancel commands; a draft delete command needs
  confirming (no organiser delete-draft RPC was checked). Open questions 1 (paused) and 2 (bulk Put live) still stand. Then an
  implementation brief.
- **Not verified:** not opened on a real phone. Names, dates and counts are examples shaped by the round 1 survey (no new prod
  read this round: the fixes change layout and copy, not the data shapes). The 30-night grouping threshold is a design guess
  from that survey (8 organisers have 1 to 5 dates, 7 have 100+), not tested with organisers. Whether a failed bulk cancel can be
  reported per night, whether "this and after" and "whole series" cancel exist server-side, and what the cancel message really
  sends are unconfirmed (careful lane 1-3). No app code changed, so there was no browser walk of a running route.
