# Seven minimum edits: organiser area walk, round 1 (CODE-READ ONLY)

Branch `claude/walk-seven-edits`, read from `origin/main` (ba0814b). Flags assumed: `VITE_ENABLE_ORGANISER_SELF_SERVE=true`, `VITE_ENABLE_ORGANISER_P3=true`.

**Read this first.** This round is a code read, not a live walk. `~/.claude/bin/walk-session.mjs` and `laptop-walk.mjs` do not exist in this cloud worker, and there is no test-account session. There are no screenshots, no measured tap sizes and no light/dark check. Every row below says what the code does. Tap counts are counted from the handlers: a tap is one press, file-picker choices are not counted, and "scroll" is listed separately. Round 2 needs a live walk before anyone trusts the friction ranking.

The four WALK drafts were not opened. Recurring and one-off behave the same wherever the code does not branch on date count. Where it does branch, that is noted.

Files read: `p3/screens/{EventPage,DetailsScreen,DateSheet,DateFieldSheets,SessionSheet,LineupSheet,PricesScreen,PriceCard,EditTray}.tsx`, `p3/model/{labels,saveModel}.ts`, `p3/data/dateFields.ts`, `tickets/TicketsEntry.tsx` (grep only).

## Table: edit x recurring x one-off

"All" = the event's setting, used by every date. "Date" = one date's own override, reached from Coming up, then a date row. Taps start on the event page.

| # | Edit | Recurring (many dates) | One-off | Saved proof | Scope asked? |
|---|------|------------------------|---------|-------------|--------------|
| 1 | Description | **Yes.** All: row "Name and details" (1) &rarr; tap About box (2) &rarr; type &rarr; "Save for all dates" (3). One date: date row (1) &rarr; date row again (2) &rarr; "Description" Change (3) &rarr; type &rarr; save (4). | Yes, same path as All (3 taps). | Returns to event page with toast "Saved for every date. Dancers see it now." (`labels.ts:259`). Date: "Saved for {day} only". | No question. The screen you enter decides: Details = every date, date sheet = this date. |
| 2 | Flyer (cover photo) | **Yes.** All: "Name and details" (1) &rarr; "Add/Choose a new cover photo" (2) &rarr; pick file &rarr; Save (3). One date: date row &rarr; date row &rarr; "Photo" Change &rarr; pick file (3 taps). | Yes (3 taps). | All: the preview swaps in the form and the toast after Save. Date: saved the moment the file is chosen (`DateSheet.tsx:343-345`), no Save tap, no confirmation step. | No question. Same as above. |
| 3 | Gallery | **Every date: NO.** Details has no gallery field (`DetailsScreen.tsx`, `EventPage.tsx:156-173`). Only one date at a time: date row &rarr; date row &rarr; "Photos" Change &rarr; Add photos &rarr; "Save for this date" (4 taps). On a 30-date weekly that is 30 times. | Yes via the one date (4 taps); it acts as the event's gallery. | Toast "Saved for {day} only". | The only path is "this date" (title says "Photos for this date only", `labels.ts:313`). There is no "all dates" option. |
| 4 | Sessions (add / edit / remove) | **Yes.** Add: "Add a session" (1) &rarr; name, type, times &rarr; "Add this session" (2). Edit: tap row (1) &rarr; change &rarr; "Save for all dates" (2). Remove: row &rarr; remove-all / remove-one buttons. | Yes, same. | Toast "Saved for every date. Dancers see it now." (`labels.ts:216`). | **Yes**, inline "Which dates?" radio, every date or one date (`SessionSheet.tsx:165-177`). Switching clears typing and says so (`scopeClears`). |
| 5 | People of a session | **Yes.** Row (1) &rarr; line-up button (2) &rarr; type 2+ letters, tap a result (3) &rarr; "Save line-up" (4). Takes teachers and DJs only. Classes/masterclass add teachers, parties add DJs, anything else is team-only (`programmeSeriesModel.ts:235`). | Yes. | Toast "Line-up saved for every date." (`labels.ts:224`). | Inherits the scope chosen in the session sheet; shown as `name &middot; where` at the top of the sheet. |
| 6 | Levels | **Yes, for session types where levels apply** (`SessionSheet.tsx:236`). Row (1) &rarr; tap level chips &rarr; Save (2). A type with no levels shows no control and no reason. | Yes. | Same toast as 4. | Same scope picker as 4. |
| 7 | Tickets: link and prices | **Link: yes.** All: "Name and details" &rarr; Ticket link field (type, tap Save): 3 taps. One date: date sheet "Ticket" row. **Prices: yes.** "Prices" row (1) &rarr; "Add a price" (2) &rarr; name, amount, currency &rarr; "Save for all dates" (3). One date: "Price" row in the date sheet. | Yes, same. | "Prices saved. Dancers see them now." (`labels.ts:273`). | No question: Prices = every date; date sheet = one date. |

Not walked, so unknown: whether the `organiserTicketing` flag (Stripe/Scan-tickets rows, `EventPage.tsx:225-234`) is on for first organisers. If it is, "Tickets" will appear above Sessions beside a plain "Prices" row, and "tickets (link and prices)" gets two homes.

## Scope question ("this date or all dates")

- **Sessions:** asked inline, correctly.
- **Flyer, venue, description, ticket link, prices, name, photos:** never asked in a sheet. You are placed in "all dates" by the Details/Prices screens and in "this date" by the date sheet (`DateSheet.tsx:267-281`, rows with "Only this date" / "Same as usual" labels). The model is consistent, but a first-timer on Details is not told that "this date only" exists somewhere else, and the Details button always says "Save for all dates", even on a one-off with one date.
- **Description:** no ask. Per-date override exists (`edit-about`).

## Save, Saved, and leaving

- **Button text:** Details and Prices say "Save for all dates" while there are changes, "Nothing changed yet" when none; "Saving&hellip;" while busy. A blocked change keeps the button greyed and shows the reason below it (`saveModel.ts:53-59`). Session sheet: "Add this session" / "Save for all dates" / "Save for this date". Date field sheets: "Save for this date".
- **Saved proof:** the screen goes back to the event page and a toast says what saved and who sees it. Good words. Nothing on Details itself confirms, because the screen is left.
- **Unsaved changes:** a "Not saved yet &middot; N changes (tap to see)" strip appears (`EditTray.tsx:213`); Back and router navigation ask "Leave without saving?" with "Leave and lose them" (`labels.ts:283-285`); date field sheets ask "Leave without saving? / Keep editing". Undo is behind a confirm. Browser unload guard is wired (`useLeaveGuard`). Not exercised live.

## Ranked friction

**High**

1. **No gallery for the whole event.** Only per-date photos exist; a weekly party with 30 dates needs 30 uploads to give every date the same gallery. Fix: add a "Photos" field to `DetailsScreen.tsx` (after the cover, ~line 127) using the `PhotosSheet` upload path (`DateFieldSheets.tsx:90-140`) and the series gallery command, or a "Photos for all dates" row. `data/dateFields.ts:43` already reads `ws.gallery`.
2. **Edit rows sit at the bottom of the page.** On a weekly with sessions and "Coming up" rows, "Name and details" and "Prices" are under About, after both lists (`EventPage.tsx:235-237`; rows `:157-164`). Description, flyer and ticket link all go through them. Fix: move the `p3-edit-rows` card above Sessions, or add the edit rows directly under the header card. Needs a live scroll measurement.

**Med**

3. **Date flyer saves on file pick with no confirmation** (`DateSheet.tsx:343-345`) while every other edit has a Save step. Fix: stage the upload and show the common Save button, or add a "Saved" line in the sheet.
4. **Cover upload happens before Save** (`DetailsScreen.tsx:63`): a file is uploaded as soon as it is chosen, then Undo or Leave only drops the draft link. Fix: stage the file and upload on Save, or say "Uploaded. Save to use it."
5. **Details save always says "for all dates", even for a one-off** (`labels.ts:96`, used by `EditTray.tsx:206`). For a single date, it reads like something is missing. Fix: say "Save" when the event has one date.
6. **Ticket link is buried mid-form** between "Where" and "Cover photo" (`DetailsScreen.tsx:113`), a screen of 10 fields where the first-timers' needs are description, cover, ticket. Fix: order name, about, cover, ticket link first, the rest under "More".
7. **Price name/amount/currency: three fields per price** (`PriceCard.tsx`). The amount placeholder is `15` and the currency is a select. Fix: default currency from the venue/city and collapse it.
8. **Levels control vanishes for some session types with no explanation** (`SessionSheet.tsx:236`). Fix: show a one-line "Levels aren't used for {type}".
9. **Two "ticket" homes if `organiserTicketing` is on** (`EventPage.tsx:225`). Fix: label the Stripe entry "Sell tickets here" to keep it apart from "Ticket link".

**Low**

10. Label drift: "Prices" (event) vs "Price" (date), "Photo" vs "Photos" vs "Cover photo" (`labels.ts:245,306-308`). Fix: one word per thing.
11. Person search needs 2 letters, with the hint only shown below the box (`LineupSheet.tsx:408`). Fine, but check on a phone.
12. Line-up sheet is the third level down (event &rarr; session &rarr; line-up). 4 taps to change a DJ is acceptable for weeklies; the session row could show a "Change DJ" shortcut.

## Verified / Not verified

**Verified (by reading `origin/main`, nothing executed):** which of the seven edits exist, where the scope picker exists, the button words, the toast words, the leave-guard words.

**Not verified:**
- Any behaviour on a phone. No walk tooling, no test-account session, no Playwright run, no screenshots at 390x844, no light/dark check.
- Real recurring data: I did not open the WALK weekly30/16/lineup or oneoff-2dates drafts, so the tap-count and the 100-row-cap behaviour on 30 dates are unobserved.
- The 8-row Screen quality bar (font size &ge;16px, tap size &ge;44px, tone on screen): not measured. `.p3-btn-sm` has `min-width: 88px` only (`theme/p3.css:250`); height not checked.
- Whether the flyer, venue and description saves actually reach the public page (admin RPCs).
- That the leave guard fires in a real browser, or that the "Saved" toast shows long enough to read.
- The ranking above is a code-reading guess until a live walk.
